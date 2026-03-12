import * as vscode from 'vscode'
import * as path from 'path';
import { StreamingFileWriter } from './streamingWriter';
import { ProjectAnalyzer } from './projectAnalyzer';
import { EditPlanner, EditPlan, PatchBlock } from './editPlanner';
import { ProjectData } from './analysisStorage';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmartEditResult {
    success: boolean;
    filePath: string;
    patchesApplied: number;
    failedPatches: PatchBlock[];
    summary: string;
    sideEffects: string;
    backupContent: string;
    updateId: string | null;
}

// ─── SmartEditor ──────────────────────────────────────────────────────────────

export class SmartEditor {
    private view?: vscode.WebviewView;
    private backendUrl: string;
    private analyzer: ProjectAnalyzer;
    private planner: EditPlanner;

    constructor(backendUrl: string, analyzer: ProjectAnalyzer, view?: vscode.WebviewView) {
        this.backendUrl = backendUrl;
        this.analyzer = analyzer;
        this.planner = new EditPlanner();
        this.view = view;
    }

    public setView(view: vscode.WebviewView): void {
        this.view = view;
    }

    // ─── Main entry: handle a smart edit request ──────────────────────────────

    /**
     * Called when user asks to modify/fix/add to an existing file.
     * Returns true if the edit was handled (caller should not fall through to AI).
     */
    public async handleEditRequest(
        userMessage: string,
        projectData: ProjectData | null
    ): Promise<boolean> {
        const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!rootUri) return false;

        // ── Build the edit plan ───────────────────────────────────────────────
        const activeFilePath = vscode.window.activeTextEditor
            ? vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.fileName)
            : undefined;

        const plan = this.planner.buildPlan(userMessage, projectData, activeFilePath);

        if (plan.targetFiles.length === 0) {
            // No target identified — let normal AI flow handle it
            return false;
        }

        // ── Show dependency warning if needed ─────────────────────────────────
        if (plan.warningMessage) {
            this.post('status', plan.warningMessage);
        }

        // ── Process each target file ──────────────────────────────────────────
        this.post('thinking', '');

        const results: SmartEditResult[] = [];

        for (const relPath of plan.targetFiles) { // process all target files
            const result = await this.editSingleFile(relPath, userMessage, plan, rootUri);
            results.push(result);

            if (!result.success) {
                this.post('status', `⚠️ Could not apply patches to ${relPath} — falling back to full AI rewrite`);
                // Fallback: let the regular AI handler deal with this 
            }
        }

        // ── Build combined response message ───────────────────────────────────
        const successfulEdits = results.filter(r => r.success);
        const failedEdits = results.filter(r => !r.success);

        if (successfulEdits.length === 0) return false; // let normal flow handle

        let responseText = `✅ **Smart Edit Complete**\n\n`;

        for (const res of successfulEdits) {
            responseText += `**${res.filePath}**\n`;
            responseText += `- ${res.patchesApplied} patch(es) applied\n`;
            responseText += `- ${res.summary}\n`;
            if (res.sideEffects) responseText += `- ⚡ ${res.sideEffects}\n`;
            if (res.failedPatches.length > 0) {
                responseText += `- ⚠️ ${res.failedPatches.length} patch(es) could not be located and were skipped\n`;
            }
            responseText += '\n'
        }

        if (failedEdits.length > 0) {
            responseText += `\n⚠️ Could not edit: ${failedEdits.map(r => r.filePath).join(', ')}`;
        }

        if (plan.dependentFiles.length > 0) {
            responseText += `\n\n📎 **Files that may be affected:** ${plan.dependentFiles.join(', ')}`;
        }

        responseText += `\n\n*Reply "looks good" to confirm, or describe what still needs changing.*`;
        this.post('response', responseText);
        return true;
    }

    // ─── Edit a single file ───────────────────────────────────────────────────

    private async editSingleFile(
        relPath: string,
        userMessage: string,
        plan: EditPlan,
        rootUri: vscode.Uri
    ): Promise<SmartEditResult> {
        const fileUri = vscode.Uri.joinPath(rootUri, relPath);

        let currentContent: string;
        try {
            currentContent = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf8');
        } catch {
            return this.failResult(relPath, `File not found: ${relPath}`);
        }

        // ── Save pre-edit snapshot to .vibeproject.json ───────────────────────
        let updateId: string | null = null;
        try {
            updateId = await this.analyzer.recordFileOperation(
                relPath,
                'update',
                `User requested: ${userMessage.slice(0, 100)}`,
                'Smart surgical patch edit'
            );
        } catch (err) {
            return this.failResult(relPath, `Failed to create backup snapshot: ${err}`);
        }

        // ── Build prompt and call AI ──────────────────────────────────────────
        const contextSummary = await this.analyzer.getContextSummary();
        const prompt = this.planner.buildSurgicalPrompt({
            filePath: relPath,
            currentContent,
            userRequest: userMessage,
            plan,
            projectContext: contextSummary
        });

        let patches: PatchBlock[] = [];
        let newImports: string[] = [];
        let summary = '';
        let sideEffects = '';

        try {
            const aiResponse = await this.callSmartEditBackend(prompt);
            patches = aiResponse.patches || [];
            newImports = aiResponse.newImports || [];
            summary = aiResponse.summary || 'Changes applied';
            sideEffects = aiResponse.sideEffects || '';
        } catch (err) {
            console.error('[SmartEditor] AI call failed:', err);
            return this.failResult(relPath, `AI call failed: ${err}`);
        }

        if (patches.length === 0) {
            return this.failResult(relPath, 'AI returned no patches');
        }

        // ── Apply imports first, then patches ────────────────────────────────
        let newContent = this.planner.applyNewImports(currentContent, newImports);
        const { result, appliedCount, failedPatches } = this.planner.applyPatches(newContent, patches);
        newContent = result;

        if (appliedCount === 0) {
            // All patches failed to locate — abort to avoid corrupting file
            await this.analyzer.resolveUserRequest('', 'No patches could be located in file', 'failed', [relPath]).catch(() => {});
            return this.failResult(relPath, 'Could not locate any patch targets in file');
        }

        // ── Write patch silently, then highlight only changed lines ──────────
        let diffResult: { changedLines: number[]; fileName: string } = { changedLines: [], fileName: relPath };
        try {
            diffResult = await StreamingFileWriter.patch(fileUri, currentContent, newContent);
        } catch (err) {
            return this.failResult(relPath, `Failed to write file: ${err}`);
        }

        // ── Post diff summary chip to chat ────────────────────────────────────
        if (diffResult.changedLines.length > 0) {
            this.view?.webview.postMessage({
                type: 'diff_summary',
                fileName: diffResult.fileName,
                changedLines: diffResult.changedLines
            });
        }

        // ── Update project analysis log ───────────────────────────────────────
        if (updateId) {
            await this.analyzer.confirmFileUpdate(relPath, updateId).catch(() => {});
        }

        // Re-analyze the file in background
        setTimeout(() => this.analyzer.analyzeSingleFile(relPath).catch(() => {}), 1500);

        return {
            success: true,
            filePath: relPath,
            patchesApplied: appliedCount,
            failedPatches,
            summary,
            sideEffects,
            backupContent: currentContent,
            updateId
        };
    }
    // ─── AI backend call ──────────────────────────────────────────────────────
    private async callSmartEditBackend(prompt: string): Promise<{
        patches: PatchBlock[];
        newImports: string[];
        summary: string;
        sideEffects: string;
    }> {
        const response = await fetch(`${this.backendUrl}/smart_edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
     
        if (!response.ok) {
            // Fallback: use /chat endpoint with the surgical prompt
            const fallback = await fetch(`${this.backendUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: prompt, conversation_history: '' })
            });
            if (!fallback.ok) throw new Error(`Backend error ${fallback.status}`);
            const data = await fallback.json() as { messages: any[] };
            const text = data.messages?.[0]?.text || '{}';
            return this.parseEditResponse(text);
        }

        const data = await response.json() as { result: string };
        return this.parseEditResponse(data.result || '{}');
    }
    private parseEditResponse(text: string): {
        patches: PatchBlock[];
        newImports: string[];
        summary: string;
        sideEffects: string;
    } {
        const fallback = { patches: [], newImports: [], summary: '', sideEffects: '' };
        try {
            const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(clean);
            return {
                patches: parsed.patches || [],
                newImports: parsed.newImports || [],
                summary: parsed.summary || '',
                sideEffects: parsed.sideEffects || ''
            };
        } catch {
            // Try to extract JSON object from mixed text
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    const parsed = JSON.parse(match[0]);
                    return {
                        patches: parsed.patches || [],
                        newImports: parsed.newImports || [],
                        summary: parsed.summary || '',
                        sideEffects: parsed.sideEffects || ''
                    };
                } catch { /* fall through */ }
            }
            return fallback;
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private failResult(filePath: string, reason: string): SmartEditResult {
        console.warn(`[SmartEditor] ${reason}`);
        return {
            success: false,
            filePath,
            patchesApplied: 0,
            failedPatches: [],
            summary: reason,
            sideEffects: '',
            backupContent: '',
            updateId: null
        };
    }
    private post(type: string, text: string): void {
        this.view?.webview.postMessage({ type, text });
    }
}
    



import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- Game State & Variables ---
let scene, camera, renderer, composer;
let bugGroup, gridHelper;
let obstacles = [];
let collectibles = [];
let particles = [];

let score = 0;
let gameActive = false;
let baseSpeed = 0.4;
let currentSpeed = baseSpeed;
let laneWidth = 3;
let targetX = 0;

const clock = new THREE.Clock();

// UI Elements
const scoreEl = document.getElementById('score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');

// --- Initialization ---
function init() {
    // Scene Setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000510, 0.015);

    // Camera Setup
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, -10);

    // Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ReinhardToneMapping;
    document.body.appendChild(renderer.domElement);

    // Post-Processing (Bloom for Neon Effect)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.1;
    bloomPass.strength = 1.8;
    bloomPass.radius = 0.5;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00ffff, 1);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    scene.add(dirLight);

    createEnvironment();
    createBug();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', handleInput);
    
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);

    // Start Animation Loop
    renderer.setAnimationLoop(animate);
}

// --- Environment Creation ---
function createEnvironment() {
    // Moving Grid Floor
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
    gridHelper = new THREE.GridHelper(200, 100, 0x00ffff, 0x004444);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // Solid Floor for shadows
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x000510, roughness: 0.8, metalness: 0.2 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.51;
    floor.receiveShadow = true;
    scene.add(floor);
}

// --- Bug Creation ---
function createBug() {
    bugGroup = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.4, 1.2, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x00ff00, 
        emissive: 0x004400, 
        roughness: 0.2, 
        metalness: 0.8 
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    bugGroup.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.z = -0.8;
    head.castShadow = true;
    bugGroup.add(head);

    // Eyes (Glowing)
    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 0.15, -1.05);
    bugGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15, 0.15, -1.05);
    bugGroup.add(rightEye);

    // Wings (Translucent)
    const wingGeo = new THREE.BufferGeometry();
    const wingVertices = new Float32Array([
        0, 0, 0,
        1, 0.2, -0.5,
        0.2, 0, 1
    ]);
    wingGeo.setAttribute('position', new THREE.BufferAttribute(wingVertices, 3));
    wingGeo.computeVertexNormals();
    const wingMat = new THREE.MeshStandardMaterial({ 
        color: 0x00ffff, 
        emissive: 0x0088ff, 
        transparent: true, 
        opacity: 0.6, 
        side: THREE.DoubleSide 
    });

    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-0.2, 0.4, -0.2);
    leftWing.rotation.y = -Math.PI / 6;
    bugGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(0.2, 0.4, -0.2);
    rightWing.scale.x = -1;
    rightWing.rotation.y = Math.PI / 6;
    bugGroup.add(rightWing);

    // Bug Light
    const bugLight = new THREE.PointLight(0x00ff00, 2, 10);
    bugLight.position.set(0, 1, 0);
    bugGroup.add(bugLight);

    scene.add(bugGroup);
}

// --- Game Logic ---
function startGame() {
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    // Reset state
    score = 0;
    scoreEl.innerText = score;
    currentSpeed = baseSpeed;
    targetX = 0;
    bugGroup.position.set(0, 0, 0);
    
    // Clear existing objects
    obstacles.forEach(obs => scene.remove(obs));
    collectibles.forEach(col => scene.remove(col));
    particles.forEach(p => scene.remove(p));
    obstacles = [];
    collectibles = [];
    particles = [];

    gameActive = true;
}

function gameOver() {
    gameActive = false;
    finalScoreEl.innerText = score;
    gameOverScreen.classList.add('active');
    createExplosion(bugGroup.position, 0x00ff00);
    bugGroup.position.y = -10; // Hide bug
}

function handleInput(event) {
    if (!gameActive) return;
    
    if (event.key === 'ArrowLeft' || event.key === 'a') {
        targetX = Math.max(targetX - laneWidth, -laneWidth * 2);
    } else if (event.key === 'ArrowRight' || event.key === 'd') {
        targetX = Math.min(targetX + laneWidth, laneWidth * 2);
    }
}

// --- Spawning ---
function spawnObjects() {
    if (Math.random() < 0.05 + (currentSpeed * 0.02)) {
        spawnObstacle();
    }
    if (Math.random() < 0.03) {
        spawnCollectible();
    }
}

function spawnObstacle() {
    const geo = new THREE.ConeGeometry(0.8, 2, 4);
    const mat = new THREE.MeshStandardMaterial({ 
        color: 0xff0000, 
        emissive: 0x880000, 
        roughness: 0.1 
    });
    const obstacle = new THREE.Mesh(geo, mat);
    
    const lane = Math.floor(Math.random() * 5) - 2; // -2 to 2
    obstacle.position.set(lane * laneWidth, 0.5, -100);
    obstacle.castShadow = true;
    
    scene.add(obstacle);
    obstacles.push(obstacle);
}

function spawnCollectible() {
    const geo = new THREE.IcosahedronGeometry(0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ 
        color: 0x0088ff, 
        emissive: 0x0044ff, 
        wireframe: true 
    });
    const collectible = new THREE.Mesh(geo, mat);
    
    const lane = Math.floor(Math.random() * 5) - 2;
    collectible.position.set(lane * laneWidth, 1, -100);
    
    const light = new THREE.PointLight(0x0088ff, 1, 5);
    collectible.add(light);

    scene.add(collectible);
    collectibles.push(collectible);
}

// --- Particles ---
function createExplosion(position, color) {
    const particleCount = 20;
    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const mat = new THREE.MeshBasicMaterial({ color: color });

    for (let i = 0; i < particleCount; i++) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        mesh.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 2,
            (Math.random() - 0.5) * 2
        );
        mesh.life = 1.0;
        scene.add(mesh);
        particles.push(mesh);
    }
}

// --- Main Loop ---
function animate() {
    const delta = clock.getDelta();

    if (gameActive) {
        // Move Bug
        bugGroup.position.x += (targetX - bugGroup.position.x) * 10 * delta;
        
        // Animate Bug (Hover & Wings)
        const time = clock.getElapsedTime();
        bugGroup.position.y = Math.sin(time * 10) * 0.1;
        bugGroup.children[4].rotation.z = Math.sin(time * 40) * 0.5; // Left wing
        bugGroup.children[5].rotation.z = -Math.sin(time * 40) * 0.5; // Right wing

        // Move Grid to simulate speed
        gridHelper.position.z = (gridHelper.position.z + currentSpeed) % 10;

        // Update Speed & Score
        currentSpeed += 0.0001;
        score += Math.floor(currentSpeed * 10);
        scoreEl.innerText = score;

        spawnObjects();

        // Update Obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.position.z += currentSpeed;
            obs.rotation.y += delta;

            // Collision
            if (obs.position.distanceTo(bugGroup.position) < 1.2) {
                gameOver();
            }

            // Remove off-screen
            if (obs.position.z > 10) {
                scene.remove(obs);
                obstacles.splice(i, 1);
            }
        }

        // Update Collectibles
        for (let i = collectibles.length - 1; i >= 0; i--) {
            const col = collectibles[i];
            col.position.z += currentSpeed;
            col.rotation.x += delta * 2;
            col.rotation.y += delta * 2;

            // Collection
            if (col.position.distanceTo(bugGroup.position) < 1.5) {
                score += 1000;
                createExplosion(col.position, 0x0088ff);
                scene.remove(col);
                collectibles.splice(i, 1);
            }
            // Remove off-screen
            else if (col.position.z > 10) {
                scene.remove(col);
                collectibles.splice(i, 1);
            }
        }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.add(p.velocity.clone().multiplyScalar(delta));
        p.life -= delta;
        p.scale.setScalar(p.life);
        if (p.life <= 0) {
            scene.remove(p);
            particles.splice(i, 1);
        }
    }

    // Render with Post-Processing
    composer.render();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// Start application
init();

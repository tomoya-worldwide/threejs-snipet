import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { Variable } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

// シェーダーコード - 元のまま保持
const velocityShader = `
  precision mediump float;

  uniform float time;
  uniform vec2 mouse;
  uniform float mouseForce;
  uniform bool mouseDown;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec2 velocity = texture2D(velocityTexture, uv).xy - 0.5; // 0.5を引いて-0.5〜0.5の範囲に
    
    // マウス位置からの距離と方向を計算
    vec2 mouseVec = uv - mouse;
    float dist = length(mouseVec);
    
    // マウスインタラクションによる力の印加 - 力を強化
    if (mouseDown && dist < 0.2) { // 影響範囲を拡大
      vec2 perpendicularForce = vec2(-mouseVec.y, mouseVec.x);
      float forceFactor = (0.2 - dist) / 1.0;
      // 力を大幅に増強して確実に視覚的効果を生み出す
      velocity += normalize(perpendicularForce) * forceFactor * mouseForce * 0.2;
    }
    
    // 減衰を少なくして持続時間を延長
    velocity *= 0.995;
    
    gl_FragColor = vec4(velocity + 0.5, 0.0, 1.0); // 0.5を足して0〜1の範囲に戻す
  }
`;

const advectionShader = `
  precision mediump float;

  uniform float time;
  
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec2 velocity = texture2D(velocityTexture, uv).xy - 0.5; // 0.5を引いて-0.5〜0.5の範囲に
    vec2 prevPos = uv - velocity * 0.01;
    vec2 newVelocity = texture2D(velocityTexture, prevPos).xy - 0.5;
    gl_FragColor = vec4(newVelocity + 0.5, 0.0, 1.0); // 0.5を足して0〜1の範囲に戻す
  }
`;

const visualizationShader = `
  precision mediump float;
  uniform sampler2D velocityTexture;
  uniform vec2 resolution;
  uniform float time;
  
  // HSV→RGB変換
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
  
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec2 velocity = texture2D(velocityTexture, uv).xy - 0.5; // 0.5を引いて-0.5〜0.5の範囲に
    
    // 速度の大きさを計算し、視認性を高めるためスケーリング
    float speed = length(velocity) * 10.0; // 10倍に増強して見やすく
    
    // 速度の方向を角度に変換
    float angle = atan(velocity.y, velocity.x) / (2.0 * 3.14159265) + 0.5;
    
    // 高コントラストな色を生成
    vec3 color = hsv2rgb(vec3(
      angle,
      0.9, // 鮮やかな彩度
      min(speed * 2.0, 0.9) + 0.1 // スケーリングを強化
    ));
    
    // 速度が非常に低い場合は暗い色に
    if (speed < 0.05) {
      color = vec3(0.05, 0.05, 0.1); // 暗い青色
    }
    
    gl_FragColor = vec4(color, 0.7);
  }
`;

// 変数
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
let gpuCompute: GPUComputationRenderer;
let velocityVariable: Variable;
let advectionVariable: Variable;
let mousePosition: THREE.Vector2 = new THREE.Vector2(0.5, 0.5);
let mouseDown: boolean = false;
let mouseForce: number = 5.0;
let frameCount: number = 0;
let isInitialized: boolean = false;
let isSimulationActive: boolean = false;
let lastActivityTime: number = 0;

// シミュレーション解像度を固定
const SIMULATION_SIZE: number = 512; // 適切なサイズ（必要に応じて調整可能）

// パーティクル関連の変数
let particles: { x: number; y: number; size: number; color: THREE.Color }[] = [];
let particleSystem: THREE.Points;
const PARTICLE_COUNT = 10; // バランスの取れたパーティクル数

// ローディング画面を表示
function showLoadingScreen(): void {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-screen';
    loadingDiv.style.position = 'fixed';
    loadingDiv.style.top = '0';
    loadingDiv.style.left = '0';
    loadingDiv.style.width = '100%';
    loadingDiv.style.height = '100%';
    loadingDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    loadingDiv.style.display = 'flex';
    loadingDiv.style.justifyContent = 'center';
    loadingDiv.style.alignItems = 'center';
    loadingDiv.style.color = 'white';
    loadingDiv.style.zIndex = '1000';
    loadingDiv.innerHTML = '<h2>流体シミュレーションを読み込み中...</h2>';
    document.body.appendChild(loadingDiv);
}

// ローディング画面を非表示
function hideLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.remove();
    }
}

// 非同期初期化関数
async function initializeAsync(): Promise<void> {
    console.log("流体シミュレーションを初期化中...");
    
    // ローディング画面表示
    showLoadingScreen();
    
    // レンダラーの設定（最適化）
    renderer = new THREE.WebGLRenderer({ 
        antialias: false,
        powerPreference: 'high-performance',
        precision: 'mediump'
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // シーンとカメラの設定
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    updateCameraAspect();

    // GPUシミュレーションを初期化
    await initGPUCompute();
    
    // パーティクルシステムを初期化
    await initParticleSystem();
    
    // イベントリスナーの設定
    setupEventListeners();
    
    // 初期化完了
    isInitialized = true;
    
    // ローディング画面を非表示
    hideLoadingScreen();

    checkPosition();
    
    // アニメーションの開始
    animate();
    
    console.log("シミュレーション初期化完了。マウス/タッチ操作が可能です。");
}

// GPUの計算を初期化
async function initGPUCompute(): Promise<void> {
    // GPUComputationRendererの初期化
    gpuCompute = new GPUComputationRenderer(SIMULATION_SIZE, SIMULATION_SIZE, renderer);

    // テクスチャの初期化
    const velocityTexture = gpuCompute.createTexture();
    initializeTexture(velocityTexture);

    // 変数の設定
    velocityVariable = gpuCompute.addVariable('velocityTexture', velocityShader, velocityTexture);
    advectionVariable = gpuCompute.addVariable('advectionTexture', advectionShader, velocityTexture);

    // 依存関係の設定
    gpuCompute.setVariableDependencies(velocityVariable, [velocityVariable]);
    gpuCompute.setVariableDependencies(advectionVariable, [velocityVariable]);

    // uniform変数の設定
    velocityVariable.material.uniforms.time = { value: 0.0 };
    velocityVariable.material.uniforms.mouse = { value: mousePosition };
    velocityVariable.material.uniforms.resolution = { value: new THREE.Vector2(SIMULATION_SIZE, SIMULATION_SIZE) };
    velocityVariable.material.uniforms.mouseForce = { value: mouseForce };
    velocityVariable.material.uniforms.mouseDown = { value: mouseDown };

    advectionVariable.material.uniforms.time = { value: 0.0 };
    advectionVariable.material.uniforms.resolution = { value: new THREE.Vector2(SIMULATION_SIZE, SIMULATION_SIZE) };

    // GPUComputationRendererの初期化を完了
    const error = gpuCompute.init();
    if (error !== null) {
        console.error("GPUCompute初期化エラー:", error);
    }

    // 表示用の平面を作成
    setupVisualizationPlane();
}

// 可視化用の平面メッシュをセットアップ
function setupVisualizationPlane(): void {
    const geometry = new THREE.PlaneGeometry(4, 4);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            velocityTexture: { value: null },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            time: { value: 0.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: visualizationShader,
        transparent: true
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = -0.1; // パーティクルの後ろに配置
    scene.add(mesh);
}

// テクスチャの初期化
function initializeTexture(texture: THREE.DataTexture): void {
    const data = texture.image.data;
    const pixels = new Uint8Array(data.buffer);
    
    // すべてのピクセルを中央値(128)に設定 - 速度ゼロ
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 128;     // X方向の速度 (中央値=ゼロ)
        pixels[i + 1] = 128; // Y方向の速度 (中央値=ゼロ)
        pixels[i + 2] = 0;
        pixels[i + 3] = 255; // アルファ
    }
}

// パーティクルシステムの初期化関数（完全修正版）
function initParticleSystem(): void {
    console.log("パーティクルシステムを初期化中...");
    
    // 既存のパーティクルシステムを削除
    if (particleSystem) {
        scene.remove(particleSystem);
        particleSystem.geometry.dispose();
        (particleSystem.material as THREE.Material).dispose();
    }
    
    // 画面のアスペクト比を取得
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    
    // パーティクルの初期化
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: Math.random(),         // x位置 (0-1)
            y: Math.random(),         // y位置 (0-1)
            size: Math.random() * 5 + 5,  // サイズを大きめに設定
            color: new THREE.Color(1.0, 1.0, 1.0)  // 白色で明るく
        });
    }

    // ジオメトリの作成
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3); // xyz座標
    const sizes = new Float32Array(PARTICLE_COUNT);
    const colors = new Float32Array(PARTICLE_COUNT * 3); // RGB

    // パーティクルの初期位置、サイズ、色を設定
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        const i3 = i * 3;
        
        // アスペクト比を考慮してパーティクル位置を設定
        if (aspect > 1) {
            positions[i3] = (p.x * 2 - 1) * aspect; // x座標をアスペクト比で拡大
            positions[i3 + 1] = p.y * 2 - 1;
        } else {
            positions[i3] = p.x * 2 - 1;
            positions[i3 + 1] = (p.y * 2 - 1) / aspect; // y座標をアスペクト比で拡大
        }
        positions[i3 + 2] = 0.3; // Z位置を確実に前面に

        // サイズと色を設定
        sizes[i] = p.size;
        colors[i3] = p.color.r;
        colors[i3 + 1] = p.color.g;
        colors[i3 + 2] = p.color.b;
    }

    // ジオメトリにデータをセット
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // バウンディングスフィアを手動で設定
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10);

    // パーティクル用のマテリアル作成
    const material = new THREE.PointsMaterial({
        size: 20,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false
    });

    // ポイントクラウドの作成とシーンへの追加
    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
    
    console.log("パーティクルシステム生成完了");
    console.log("シーン内の子要素数:", scene.children.length);
    console.log("パーティクルが含まれているか:", scene.children.includes(particleSystem));
}

// イベントリスナーの設定
function setupEventListeners(): void {
    window.addEventListener('resize', onWindowResize, false);
    
    // マウスイベントをより確実に捕捉
    document.addEventListener('mousemove', onMouseMove, { passive: false, capture: true });
    document.addEventListener('mousedown', onMouseDown, { passive: false, capture: true });
    document.addEventListener('mouseup', onMouseUp, { passive: false, capture: true });
    
    // タッチイベントをより確実に捕捉
    document.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
    
    // キーボードイベントも追加
    document.addEventListener('keydown', (event) => {
        // スペースキーで強制的に渦を発生
        if (event.code === 'Space') {
            mouseDown = true;
            // マウス位置をランダムに変更
            mousePosition.x = Math.random();
            mousePosition.y = Math.random();
            
            // シミュレーションがアクティブであることを記録
            isSimulationActive = true;
            lastActivityTime = performance.now();
            
            setTimeout(() => { mouseDown = false; }, 200);
        }
    });
}

// マウスイベントハンドラ
function onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    mouseDown = true;
    onMouseMove(event); // 位置も同時に更新
    
    // シミュレーションがアクティブであることを記録
    isSimulationActive = true;
    lastActivityTime = performance.now();
}

function onMouseUp(event: MouseEvent): void {
    event.preventDefault();
    mouseDown = false;
}

function onMouseMove(event: MouseEvent): void {
    event.preventDefault();
    mousePosition.x = event.clientX / window.innerWidth;
    mousePosition.y = 1.0 - event.clientY / window.innerHeight; // Y座標を反転
    
    // 動きがあった場合、アクティブタイムを更新
    if (mouseDown) {
        lastActivityTime = performance.now();
    }
}

// タッチイベントハンドラ
function onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    mouseDown = true;
    onTouchMove(event); // 位置も同時に更新
    
    // シミュレーションがアクティブであることを記録
    isSimulationActive = true;
    lastActivityTime = performance.now();
}

function onTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    mouseDown = false;
}

function onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (event.touches.length > 0) {
        mousePosition.x = event.touches[0].clientX / window.innerWidth;
        mousePosition.y = 1.0 - event.touches[0].clientY / window.innerHeight; // Y座標を反転
        
        // 動きがあった場合、アクティブタイムを更新
        if (mouseDown) {
            lastActivityTime = performance.now();
        }
    }
}

// カメラのアスペクト比を調整
function updateCameraAspect(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    
    // 常に画面全体を使うようにする
    if (aspect > 1) {
        // 横長画面
        camera.left = -aspect;
        camera.right = aspect;
        camera.top = 1;
        camera.bottom = -1;
    } else {
        // 縦長画面
        camera.left = -1;
        camera.right = 1;
        camera.top = 1 / aspect;
        camera.bottom = -1 / aspect;
    }
    
    camera.updateProjectionMatrix();
    
    // 可視化シェーダーのresolution uniformも更新
    if (scene && scene.children.length > 0) {
        const mesh = scene.children[0] as THREE.Mesh;
        const material = mesh.material as THREE.ShaderMaterial;
        if (material && material.uniforms && material.uniforms.resolution) {
            material.uniforms.resolution.value.x = width;
            material.uniforms.resolution.value.y = height;
        }
    }
}

// ウィンドウリサイズハンドラ
function onWindowResize(): void {
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateCameraAspect();
    
    // パーティクル位置も更新
    if (particleSystem) {
        updateParticlePositions();
    }
}

// アニメーションループ
function animate(): void {
    requestAnimationFrame(animate);
    render();
}

// レンダリング
function render(): void {
    if (!isInitialized) return;
    
    // 時間の更新
    const time = performance.now() * 0.001; // 秒単位に変換
    
    // シミュレーション活性状態の確認
    if (isSimulationActive && performance.now() - lastActivityTime > 3000) {
        isSimulationActive = false;
    }

    // uniform変数の更新
    velocityVariable.material.uniforms.time.value = time;
    velocityVariable.material.uniforms.mouse.value = mousePosition;
    velocityVariable.material.uniforms.mouseDown.value = mouseDown;
    advectionVariable.material.uniforms.time.value = time;

    // GPUの計算を実行
    gpuCompute.compute();
    
    // まずパーティクルを更新（レンダリングの前に行う）
    frameCount++;
    updateParticles();
    
    // 計算結果を表示用マテリアルに渡す
    const mesh = scene.children[0] as THREE.Mesh;
    const material = mesh.material as THREE.ShaderMaterial;
    material.uniforms.velocityTexture.value = gpuCompute.getCurrentRenderTarget(velocityVariable).texture;
    material.uniforms.time.value = time;
    
    // レンダリング
    renderer.render(scene, camera);
}

// パーティクルの位置を更新する関数
function updateParticles(): void {
    if (!particleSystem) return;

    // 毎フレームピクセルを読み取らない - コストが高いため
    if (frameCount % 5 !== 0) {
        // 現在の速度に基づいてパーティクルを移動するだけ
        updateParticlePositions();
        return;
    }
    
    // 速度データを読み取る
    const velocityRenderTarget = gpuCompute.getCurrentRenderTarget(velocityVariable);
    const readBuffer = new Float32Array(SIMULATION_SIZE * SIMULATION_SIZE * 4);
    
    renderer.readRenderTargetPixels(velocityRenderTarget, 0, 0, SIMULATION_SIZE, SIMULATION_SIZE, readBuffer);
    
    // 新しい速度データで位置を更新
    updateParticlePositions(readBuffer);
}

// パーティクルの位置を更新する関数（NaNエラー修正版）
function updateParticlePositions(readBuffer: Float32Array | null = null): void {
    // 画面のアスペクト比を取得
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    
    // パーティクルジオメトリから位置属性を取得
    const positions = particleSystem.geometry.getAttribute('position').array as Float32Array;

    // 各パーティクルの位置を更新
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        
        // 現在の位置を取得（アスペクト比を考慮して変換）
        const p = particles[i];
        
        // NaN値を避けるための安全な変換
        // 横長画面の場合
        if (aspect > 1) {
            // 0除算を避ける
            if (aspect !== 0) {
                p.x = ((positions[i3] / aspect) + 1) / 2;
            } else {
                p.x = 0.5; // デフォルト値
            }
            p.y = (positions[i3 + 1] + 1) / 2;
        } else {
            // 縦長画面の場合
            p.x = (positions[i3] + 1) / 2;
            // 0除算を避ける
            if (aspect !== 0) {
                p.y = ((positions[i3 + 1] * aspect) + 1) / 2;
            } else {
                p.y = 0.5; // デフォルト値
            }
        }
        
        // NaN値をチェック
        if (isNaN(p.x)) p.x = 0.5;
        if (isNaN(p.y)) p.y = 0.5;
        
        // readBufferが提供されている場合は速度を取得
        if (readBuffer) {
            // ピクセル座標を計算
            const pixelX = Math.floor(p.x * SIMULATION_SIZE);
            const pixelY = Math.floor(p.y * SIMULATION_SIZE);
            
            // 範囲チェック
            if (
                pixelX >= 0 && pixelX < SIMULATION_SIZE && 
                pixelY >= 0 && pixelY < SIMULATION_SIZE
            ) {
                const pixelIndex = (pixelY * SIMULATION_SIZE + pixelX) * 4;
                
                // 速度を取得（0-1の値を-0.5~0.5の範囲に変換）
                let vx = readBuffer[pixelIndex] / 255 - 0.5;
                let vy = readBuffer[pixelIndex + 1] / 255 - 0.5;
                
                // NaN値をチェック
                if (!isNaN(vx) && !isNaN(vy)) {
                    // 速度に基づいて位置を更新
                    p.x += vx * 0.05; // 影響を大きく
                    p.y += vy * 0.05; // 影響を大きく
                }
            }
        } else {
            // readBufferがない場合は、小さなランダムな移動を適用
            p.x += (Math.random() - 0.5) * 0.001;
            p.y += (Math.random() - 0.5) * 0.001;
        }
        
        // 画面外に出たら反対側に移動
        if (p.x < 0) p.x += 1;
        if (p.x > 1) p.x -= 1;
        if (p.y < 0) p.y += 1;
        if (p.y > 1) p.y -= 1;
        
        // 更新された位置を反映（NaN値を避ける）
        if (aspect > 1) {
            positions[i3] = (p.x * 2 - 1) * aspect;
            positions[i3 + 1] = p.y * 2 - 1;
        } else {
            positions[i3] = p.x * 2 - 1;
            positions[i3 + 1] = (p.y * 2 - 1) / aspect;
        }
        positions[i3 + 2] = 0.1; // Z位置を0.1に設定
        
        // 最終チェック - NaN値があれば修正
        if (isNaN(positions[i3])) positions[i3] = 0;
        if (isNaN(positions[i3 + 1])) positions[i3 + 1] = 0;
    }
    
    // 位置属性を更新
    particleSystem.geometry.getAttribute('position').needsUpdate = true;
}

// 位置関係の確認と診断
function checkPosition() {
    // カメラ設定の確認
    console.log("カメラの設定:", {
        left: camera.left,
        right: camera.right,
        top: camera.top,
        bottom: camera.bottom,
        near: camera.near,
        far: camera.far
    });
    
    // シーン内のオブジェクト情報を確認
    console.log("シーン内のオブジェクト数:", scene.children.length);
    
    // 各オブジェクトの位置情報
    scene.children.forEach((child, index) => {
        console.log(`オブジェクト[${index}]:`, {
            type: child.type,
            position: child.position,
            visible: child.visible,
            renderOrder: child.renderOrder
        });
        
        // マテリアル情報も確認
        if ((child as any).material) {
            const material = (child as any).material;
            console.log(`オブジェクト[${index}]のマテリアル:`, {
                type: material.type,
                transparent: material.transparent,
                opacity: material.opacity,
                depthTest: material.depthTest,
                depthWrite: material.depthWrite,
                blending: material.blending
            });
        }
    });
    
    // 特に重要なパーティクル情報を詳細に確認
    if (particleSystem) {
        const positions = particleSystem.geometry.getAttribute('position');
        console.log("パーティクルシステム詳細:", {
            count: positions.count,
            itemSize: positions.itemSize,
            boundingSphere: particleSystem.geometry.boundingSphere,
            frustumCulled: particleSystem.frustumCulled
        });
        
        // サンプルパーティクル位置を表示
        const positionArray = positions.array;
        for (let i = 0; i < Math.min(5, PARTICLE_COUNT); i++) {
            const i3 = i * 3;
            console.log(`パーティクル[${i}]位置:`, {
                x: positionArray[i3],
                y: positionArray[i3 + 1],
                z: positionArray[i3 + 2]
            });
        }
    }
    
    // Z軸レイヤリング関係の確認
    console.log("Z軸レイヤリング:");
    const zPositions = scene.children.map((child, index) => {
        return {
            index,
            type: child.type,
            z: child.position.z,
            isParticle: child === particleSystem
        };
    }).sort((a, b) => a.z - b.z);
    console.log(zPositions);
    
    // 可視化処理の確認
    if (zPositions.length >= 2) {
        const diff = Math.abs(zPositions[1].z - zPositions[0].z);
        console.log(`Z軸差分: ${diff}`);
        if (diff < 0.1) {
            console.warn("Z軸差分が小さすぎる可能性: Z-fightingのリスクあり");
            
            // Z位置を調整
            console.log("Z位置を自動調整します");
            scene.children.forEach(child => {
                if (child === particleSystem) {
                    child.position.z = 0.3; // パーティクルを前に
                    console.log("パーティクルのZ位置を 0.3 に調整しました");
                } else if (child.type === "Mesh") {
                    child.position.z = -0.3; // 平面を後ろに
                    console.log("平面のZ位置を -0.3 に調整しました");
                }
            });
        }
    }
    
    // カメラの Far クリッピングプレーンを調整
    const oldFar = camera.far;
    camera.far = 10;
    camera.updateProjectionMatrix();
    console.log(`カメラの Far プレーンを ${oldFar} から 10 に調整しました`);
    
    // レンダリング順序を最適化
    scene.children.forEach((child, index) => {
        if (child === particleSystem) {
            child.renderOrder = 1; // パーティクルを後で描画
            console.log("パーティクルのレンダリング順序を 1 に設定しました");
        } else if (child.type === "Mesh") {
            child.renderOrder = 0; // 平面を先に描画
            console.log("平面のレンダリング順序を 0 に設定しました");
        }
    });
}

// default関数としてexport（demo実行用）
export default function(): void {
    // 非同期初期化を開始
    initializeAsync();
}

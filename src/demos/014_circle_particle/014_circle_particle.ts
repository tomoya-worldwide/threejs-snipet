// Three.jsを使った複数の揺らいだ円 - 互いに素の振幅で同調を防ぐ
import * as THREE from 'three';
import { Euler, Vector3 } from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import GUI from 'lil-gui';

import gearAsset from './gear.glb?url';

// CircleSettings型の定義
interface CircleSettings {
  radius: number;
  wobblePeriod: number;
  radiusVariation: number;
  wobbleAmplitude: number;
  waveAmplitude: number;
  particlesPerCircle: number;
  orbitSpeed: number;
  orbitModulationAmplitude: number;
  orbitModulationFrequency: number;
  scatterFactor: number;        // ランダム散らばり係数 (0‑1)
}

// ParticleData型の定義
interface ParticleData {
  positions: Float32Array;
  velocities: Float32Array;
  initialPositions: Float32Array;
  wobbleFactors: Float32Array;
  wobbleSpeeds: Float32Array;
  settings: CircleSettings;
}

  // メインのデモ関数をエクスポート
export default function multipleWobblyCircles(container?: HTMLElement, options?: {
  // 追加のオプションパラメータ
  mouseInteraction?: boolean;  // マウスインタラクションを有効にするかどうか（デフォルトtrue）
  mouseForce?: number;         // マウスの影響力（デフォルト0.05）
  mouseRadius?: number;        // マウスの影響範囲（デフォルト2.0）
  repelMode?: boolean;         // true: パーティクルを押しのける, false: 引き寄せる（デフォルトtrue）
  friction?: number;           // 摩擦係数（デフォルト0.98）
  returnSpeed?: number;        // 元の軌道に戻る速度の調整（デフォルト1.0）
  debug?: boolean;             // デバッグモード（デフォルトfalse）
  
  // 円の形状コントロール用パラメータ
  baseRadius?: number;         // 基本半径（デフォルト8）全ての円で共通
  circleCount?: number;        // 円の数（デフォルト5）
  
  // パーティクルの動きコントロール用パラメータ
  wobbleStrength?: number;     // ブレの基本強さ（デフォルト0.008）
  orbitSpeed?: number;         // 軌道の速度（デフォルト0.0004）
}) {
  // コンテナが指定されていない場合はdocument.bodyをデフォルトとして使用
  const targetContainer = container || document.body;
  // === Morph Button & Gear Morphing ===
  // --- lil‑gui ---
  // === GUI パラメータ (localStorage から復元) ===
  const defaultGui = {
    particleCount: 4000,
    circleCount : 3,
    rings: [
      { 揺らぎ周期: 0.02, 半径変動: 3,  揺らぎ振幅: 0.5, 波振幅: 0.8,
        軌道速度: 0.002, 軌道揺幅: 0.4, 軌道周波数: 1.5, 粒子数: 1000, 散らばり係数: 0.05 },
      { 揺らぎ周期: 0.03, 半径変動: 4.5,揺らぎ振幅: 0.8, 波振幅: 0.4,
        軌道速度: 0.0022,軌道揺幅: 0.5, 軌道周波数: 1.2, 粒子数: 1000, 散らばり係数: 0.05 },
      { 揺らぎ周期: 0.05, 半径変動: 4.0,揺らぎ振幅: 0.8, 波振幅: 0.4,
        軌道速度: 0.0026,軌道揺幅: 0.6, 軌道周波数: 1.8, 粒子数: 1000, 散らばり係数: 0.05 }
    ]
  };
  let guiParams: typeof defaultGui = JSON.parse(localStorage.getItem('circleGui') || 'null') || defaultGui;

  // circleCount と rings 長を合わせ、各リングに必須キーを補完
  function syncRings() {
    const defaultRing = {
      揺らぎ周期: 0.04,
      半径変動: 3,
      揺らぎ振幅: 1,
      波振幅: 0.8,
      軌道速度: 0.002,
      軌道揺幅: 0.4,
      軌道周波数: 1.5,
      粒子数: 1000,
      散らばり係数: 0.05,
    };

    // 長さを調整
    while (guiParams.rings.length < guiParams.circleCount) {
      guiParams.rings.push({ ...defaultRing });
    }
    if (guiParams.rings.length > guiParams.circleCount) {
      guiParams.rings.length = guiParams.circleCount;
    }

    // 各リングに必須キーがない場合は補完
    guiParams.rings.forEach((r, idx) => {
      Object.keys(defaultRing).forEach((k) => {
        if (r[k as keyof typeof defaultRing] === undefined) {
          // @ts-ignore – dynamic key
          r[k] = defaultRing[k as keyof typeof defaultRing];
        }
      });
    });
  }
  syncRings();
  const gui = new GUI();
  const saveGui = () => localStorage.setItem('circleGui', JSON.stringify(guiParams));
  gui.add(guiParams, 'circleCount', 1, 10, 1)
     .name('円環の個数')
     .onFinishChange(() => {
        syncRings();
     });

  guiParams.rings.forEach((ring, idx) => {
    const f = gui.addFolder(`円環 ${idx + 1}`);
    f.add(ring, '揺らぎ周期', 0.005, 0.1, 0.001);
    f.add(ring, '半径変動',   0.1, 10, 0.1);
    f.add(ring, '揺らぎ振幅', 0.1, 2, 0.1);
    f.add(ring, '波振幅',     0.1, 2, 0.1);
    f.add(ring, '軌道速度',   0.0005, 0.01, 0.0001);
    f.add(ring, '軌道揺幅',   0.1, 1, 0.05);
    f.add(ring, '軌道周波数', 0.5, 3, 0.1);
    f.add(ring, '散らばり係数', 0, 0.3, 0.01);
    f.add(ring, '粒子数', 100, 10000, 100);
  });
  gui.onFinishChange(() => {
    syncRings();
    saveGui();
    setTimeout(() => location.reload(), 50); // 小遅延で確実に保存後リロード
  });
  // ボタンを作成してdocument.bodyに追加
  const morphButton = document.createElement('button');
  morphButton.textContent = 'Morph to Gear';
  Object.assign(morphButton.style, {
    position: 'absolute',
    top: '20px',
    left: '20px',
    zIndex: '10'
  });
  document.body.appendChild(morphButton);

  // === 基本的な設定（パーティクル数を先に宣言してローダーでも使う） ===
  // パーティクル数は guiParams から参照

  // fox.glbの頂点座標格納用
  const loader = new GLTFLoader();
  let gearPositions: Float32Array | null = null;
  loader.load(gearAsset, (gltf: GLTF) => {
    // ギアメッシュを取得
    let foundMesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> | null = null;
    gltf.scene.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry instanceof THREE.BufferGeometry) {
        foundMesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
      }
    });
    if (!foundMesh) {
      console.warn('gear mesh not found');
      return;
    }

    const mesh = foundMesh as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
    const geo  = mesh.geometry as THREE.BufferGeometry;
    const posAttr = geo.attributes.position;
    if (!posAttr || posAttr.count === 0) {
      console.warn('gear mesh has no position attribute or is empty');
      return;
    }
    const triCount = Math.floor(posAttr.count / 3);  // ensure integer

    // --- 面積累積配列を作成 ---
    const areas: number[] = new Array(triCount);
    let totalArea = 0;
    const vA = new Vector3(), vB = new Vector3(), vC = new Vector3();
    for (let i = 0; i < triCount; i++) {
      vA.fromBufferAttribute(posAttr, i * 3);
      vB.fromBufferAttribute(posAttr, i * 3 + 1);
      vC.fromBufferAttribute(posAttr, i * 3 + 2);

      // 面積 = |(B‑A) × (C‑A)| / 2
      const area = vB.clone().sub(vA).cross(vC.clone().sub(vA)).length() * 0.5;

      totalArea += areas[i] = area;
    }
    for (let i = 1; i < triCount; i++) areas[i] += areas[i - 1]; // 累積和

    // --- パーティクル数分サンプリング ---
    const sampleCnt = guiParams.rings.reduce((s, r) => s + (r.粒子数 || 0), 0);
    const sampledPos = new Float32Array(sampleCnt * 3);
    const rotEuler   = new Euler(-Math.PI / 0.8, -Math.PI / 0.5, 0); // X軸 -90°で正面に

    const tmpP = new Vector3();
    for (let i = 0; i < sampleCnt; i++) {
      // 面を面積比例で選択
      const r = Math.random() * totalArea;
      let t   = areas.findIndex(a => a >= r);
      if (t < 0) t = triCount - 1;

      // 三角形頂点
      vA.fromBufferAttribute(posAttr, t * 3);
      vB.fromBufferAttribute(posAttr, t * 3 + 1);
      vC.fromBufferAttribute(posAttr, t * 3 + 2);

      // ランダム重心座標
      const u = Math.random();
      const v = Math.random() * (1 - u);
      const w = 1 - u - v;

      tmpP.set(
        vA.x * u + vB.x * v + vC.x * w,
        vA.y * u + vB.y * v + vC.y * w,
        vA.z * u + vB.z * v + vC.z * w
      )
      .applyEuler(rotEuler)          // 向き補正
      .add(mesh.position)            // メッシュのワールド位置を反映
      .add(new Vector3(0, 0, 0));   // X方向に -2 シフト

      sampledPos[i * 3]     = tmpP.x;
      sampledPos[i * 3 + 1] = tmpP.y;
      sampledPos[i * 3 + 2] = tmpP.z;
    }

    gearPositions = sampledPos; // 置き換え
  });

  // モーフィング制御用
  let morphing = false;
  let morphProgress = 0;
  let freezeMotion = false;
  morphButton.onclick = () => {
    if (gearPositions) {
      morphing = true;
      morphProgress = 0;
      freezeMotion = false;
    }
  };
  
  // オプションの初期化
  const mouseInteraction = options?.mouseInteraction !== undefined ? options.mouseInteraction : true;
  const mouseForce = options?.mouseForce !== undefined ? options.mouseForce : 0.2;
  const mouseRadius = options?.mouseRadius !== undefined ? options.mouseRadius : 1.0;
  const repelMode = options?.repelMode !== undefined ? options.repelMode : true;
  const friction = options?.friction !== undefined ? options.friction : 0.98;
  const returnSpeedFactor = options?.returnSpeed !== undefined ? options.returnSpeed : 1.0;
  const debugMode = options?.debug !== undefined ? options.debug : false;
  
  // 基本的な設定
  const baseRadius = options?.baseRadius !== undefined ? options.baseRadius : 8; // 基本半径
  const circleCount = guiParams.circleCount;
  const particleSize = 0.04; // 基本パーティクルサイズ
  // const wobbleStrength = options?.wobbleStrength !== undefined ? options.wobbleStrength : 0; // ブレの基本強さ 
  
  // explicitCircleSettings を guiParams.rings からマッピング
  const explicitCircleSettings = guiParams.rings.map(r => ({
    wobblePeriod: r.揺らぎ周期,
    radiusVariation: r.半径変動,
    wobbleAmplitude: r.揺らぎ振幅,
    waveAmplitude: r.波振幅,
    orbitSpeed: r.軌道速度,
    orbitModulationAmplitude: r.軌道揺幅,
    orbitModulationFrequency: r.軌道周波数,
    scatterFactor: r.散らばり係数
  }));
  
  
  // 円ごとの設定を保持する配列
  const circleSettings: CircleSettings[] = [];
  
  // 各円の設定を初期化
  for (let i = 0; i < circleCount; i++) {
    // 5つ以上の円が設定された場合は、設定をループして使う
    const settingIndex = i % explicitCircleSettings.length;
    const circleConfig = explicitCircleSettings[settingIndex];
    
    // 全ての円で同じ半径を使用
    const radius = baseRadius;
    
    // 明示的に設定した値を使用
    const wobblePeriod = circleConfig.wobblePeriod;
    const radiusVariation = circleConfig.radiusVariation;
    const wobbleAmplitude = circleConfig.wobbleAmplitude;
    const waveAmplitude = circleConfig.waveAmplitude;
    const orbitSpeed = circleConfig.orbitSpeed;
    const orbitModulationAmplitude = circleConfig.orbitModulationAmplitude;
    const orbitModulationFrequency = circleConfig.orbitModulationFrequency;
    const scatterFactor = circleConfig.scatterFactor;
    circleSettings.push({
      radius,
      wobblePeriod,
      radiusVariation,
      wobbleAmplitude,
      waveAmplitude,
      particlesPerCircle: guiParams.rings[i].粒子数,
      orbitSpeed,
      orbitModulationAmplitude,
      orbitModulationFrequency,
      scatterFactor,
    });
  }
  
  // シーンの初期化
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xECF0F1); // サイトの背景色
  
  // 初期化時にコンソールログを追加
  console.log("Initializing multiple wobbling circles demo...");
  
  // マウスインタラクション用の変数
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // Z=0平面
  const mousePosition3D = new THREE.Vector3();
  let isMouseActive = false;
  let mouseLastUpdateTime = 0;
  
  // マウスの3D位置を視覚化するためのヘルパー（デバッグ用）
  let mouseHelper: THREE.Mesh | null = null;
  if (debugMode && mouseInteraction) {
    mouseHelper = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 })
    );
    scene.add(mouseHelper);
  }

  // カメラの設定
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 20;

  // レンダラーの設定
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  targetContainer.appendChild(renderer.domElement);
  
  // マウスイベントハンドラー
  if (mouseInteraction) {
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseleave', onMouseLeave);
    renderer.domElement.addEventListener('mouseenter', onMouseEnter);
  }
  
  // マウス移動イベントハンドラー
  function onMouseMove(event: MouseEvent) {
    // マウス位置を正規化 (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // レイキャスターを更新
    raycaster.setFromCamera(mouse, camera);
    
    // レイとZ平面の交点を計算
    raycaster.ray.intersectPlane(mousePlane, mousePosition3D);
    
    isMouseActive = true;
    mouseLastUpdateTime = Date.now();
    
    // デバッグ用のヘルパーを更新
    if (debugMode && mouseHelper) {
      mouseHelper.position.copy(mousePosition3D);
      mouseHelper.visible = true;
    }
  }
  
  function onMouseLeave() {
    isMouseActive = false;
    if (debugMode && mouseHelper) {
      mouseHelper.visible = false;
    }
  }
  
  function onMouseEnter() {
    isMouseActive = true;
  }

  // 全パーティクルシステムを格納する配列
  const particleSystems: THREE.Points[] = [];
  const particlesData: ParticleData[] = [];

  // カラーグラデーションの定義 - すべての円で同じ色を使用
  const commonColorStops: Array<{pos: number, color: THREE.Color}> = [
    { pos: 0, color: new THREE.Color(0xff4040) },    // 赤
    { pos: 0.2, color: new THREE.Color(0xff3080) },  // 赤紫
    { pos: 0.4, color: new THREE.Color(0xc020ff) },  // 紫
    { pos: 0.6, color: new THREE.Color(0x4040ff) },  // 青
    { pos: 0.8, color: new THREE.Color(0x20a0c0) },  // 青緑
    { pos: 1, color: new THREE.Color(0xff4040) }     // 赤（循環）
  ];

  // 角度からグラデーションカラーを取得する関数
  function getColorAtAngle(angle: number, colorStops: Array<{pos: number, color: THREE.Color}>): THREE.Color {
    // 角度を0～1の範囲に正規化
    const normalizedPos = (angle / (Math.PI * 2)) % 1;
    
    // 対応する色ストップを見つける
    let startStop, endStop;
    for (let i = 0; i < colorStops.length - 1; i++) {
      if (normalizedPos >= colorStops[i].pos && normalizedPos <= colorStops[i + 1].pos) {
        startStop = colorStops[i];
        endStop = colorStops[i + 1];
        break;
      }
    }
    
    // 見つからない場合（通常ありえないが）、最初と最後のストップを使用
    if (!startStop || !endStop) {
      startStop = colorStops[colorStops.length - 1];
      endStop = colorStops[0];
    }
    
    // 2点間での位置を計算
    const localPos = (normalizedPos - startStop.pos) / (endStop.pos - startStop.pos);
    
    // 色を補間
    const color = new THREE.Color();
    color.r = startStop.color.r + (endStop.color.r - startStop.color.r) * localPos;
    color.g = startStop.color.g + (endStop.color.g - startStop.color.g) * localPos;
    color.b = startStop.color.b + (endStop.color.b - startStop.color.b) * localPos;
    
    return color;
  }

  // 各円ごとにパーティクルシステムを作成
  for (let c = 0; c < circleCount; c++) {
    const settings = circleSettings[c];
    const particlesPerCircle = settings.particlesPerCircle;
    const radius = settings.radius;
    
    // パーティクルデータを保持する配列
    const positions = new Float32Array(particlesPerCircle * 3);
    const velocities = new Float32Array(particlesPerCircle * 3);
    const colors = new Float32Array(particlesPerCircle * 3);
    const initialPositions = new Float32Array(particlesPerCircle * 3);
    const wobbleFactors = new Float32Array(particlesPerCircle);
    const wobbleSpeeds = new Float32Array(particlesPerCircle);

    // 円形にパーティクルを配置
    for (let i = 0; i < particlesPerCircle; i++) {
      // パーティクルの角度をランダムに決定
      const angle = Math.random() * Math.PI * 2;

      // 三角波パターンを生成（より不規則に）
      const waveOffset = Math.sin(angle * settings.radiusVariation) * settings.waveAmplitude;
      const randomOffset = (Math.random() - 0.5) * radius * settings.scatterFactor; // ランダムなノイズを追加

      // 基本円半径 + 三角波オフセット + ランダムノイズ
      const particleRadius = radius + waveOffset + randomOffset;

      // 位置を計算
      const x = Math.cos(angle) * particleRadius;
      const y = Math.sin(angle) * particleRadius;
      const z = (Math.random() - 0.5) * 0.05; // Z軸方向の散らばりを小さく

      // 位置を設定
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // 初期位置を保存
      initialPositions[i * 3] = x;
      initialPositions[i * 3 + 1] = y;
      initialPositions[i * 3 + 2] = z;

      // 軌道速度を設定（接線方向）
      velocities[i * 3] = -y * settings.orbitSpeed * (0.8 + Math.random() * 0.4);
      velocities[i * 3 + 1] = x * settings.orbitSpeed * (0.8 + Math.random() * 0.4);
      velocities[i * 3 + 2] = 0;

      // パーティクルごとにブレの係数を設定 - 各円に個別の振幅を適用
      wobbleFactors[i] = 0 // wobbleStrength * settings.wobbleAmplitude * (0.9 + Math.random() * 0.2);
      wobbleSpeeds[i] = settings.wobblePeriod * (0.95 + Math.random() * 0.1);

      // 角度に基づいて色を設定 - すべての円で同じ色を使用
      const color = getColorAtAngle(angle, commonColorStops);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    // ジオメトリの作成
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('initialPosition', new THREE.Float32BufferAttribute(initialPositions, 3));
    
    // マテリアルの作成
    const material = new THREE.PointsMaterial({
      size: particleSize,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      blending: THREE.NormalBlending, // ← ここを変更
      depthWrite: false
    });
    
    // パーティクルシステムを作成してシーンに追加
    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
    
    // データを保存
    particleSystems.push(particleSystem);
    particlesData.push({
      positions,
      velocities,
      initialPositions,
      wobbleFactors,
      wobbleSpeeds,
      settings
    });
  }
  
  // デバッグ
  if (debugMode) {
    console.log("Particle systems created and added to scene");
    // 開発用：原点を示す小さな球体を追加
    const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const centerSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(centerSphere);
  }

  // 時間変数
  let time = 0;

  // アニメーション関数
  function animate() {
    requestAnimationFrame(animate);
    
    time += 0.005; // アニメーション速度
    
    // 各パーティクルシステムを更新
    let globalIdx = 0;
    for (let c = 0; c < particleSystems.length; c++) {
      updateParticles(particleSystems[c], particlesData[c], time, globalIdx);
      // 次システムの先頭インデックスを進める
      globalIdx += particleSystems[c].geometry.getAttribute('position').count;
    }
    
    // レンダリング
    renderer.render(scene, camera);
  }
  
  // パーティクルの位置を更新する関数
  function updateParticles(
    particleSystem: THREE.Points,
    data: ParticleData,
    currentTime: number,
    startIdx: number           // ← ギア配列の先頭オフセット
  ) {
    const positionAttribute = particleSystem.geometry.getAttribute('position');
    const initialPositionAttribute = particleSystem.geometry.getAttribute('initialPosition');
    const { velocities, wobbleFactors, wobbleSpeeds, settings } = data;
    
    // 属性が存在しない場合は処理をスキップ（エラー防止）
    if (!positionAttribute || !initialPositionAttribute || positionAttribute.count === 0) {
      if (debugMode) console.log("Skipping update for empty particle system");
      return;
    }
    
    const count = positionAttribute.count;
    
    // マウスアクティビティタイムアウト（5秒）
    const now = Date.now();
    const isMouseEffectActive = isMouseActive && (now - mouseLastUpdateTime < 5000);

    // morphing中でもfreezeMotion中でもなければ物理挙動を適用
    if (!morphing && !freezeMotion) {
      for (let i = 0; i < count; i++) {
        // 現在の位置を取得
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        
        // 初期位置を取得
        const initialX = initialPositionAttribute.getX(i);
        const initialY = initialPositionAttribute.getY(i);
        
        // 中心からの距離を計算
        const distance = Math.sqrt(x * x + y * y);
        
        // 理想的な半径と角度を計算
        const idealRadius = Math.sqrt(initialX * initialX + initialY * initialY);
        const angle = Math.atan2(y, x);
        const modulation = Math.sin(currentTime * settings.orbitModulationFrequency + angle) * settings.orbitModulationAmplitude;
        const targetRadius = idealRadius + modulation;
        const radiusDiff = targetRadius - distance;
        
        // 理想的な半径に戻る力
        const returnForce = 0.03 * returnSpeedFactor;
        const returnX = distance > 0.001 ? (x * radiusDiff * returnForce / distance) : 0;
        const returnY = distance > 0.001 ? (y * radiusDiff * returnForce / distance) : 0;
        
        // より不規則なブレの計算 - 互いに素の値を使って同調を防ぐ
        const timeOffset = i * 0.05;
        const phaseShift = Math.sin(currentTime * settings.wobblePeriod + i * 0.3) * 0.5;
        
        // 周期的なブレに時間とパーティクル固有の揺らぎを加える
        const wobbleX = Math.sin(currentTime * wobbleSpeeds[i] + timeOffset + phaseShift) * wobbleFactors[i];
        const wobbleY = Math.cos(currentTime * wobbleSpeeds[i] * 1.1 + timeOffset) * wobbleFactors[i];
        
        // 位置を更新
        const vIdx = i * 3;
        
        // マウスの影響を計算
        let mouseEffectX = 0;
        let mouseEffectY = 0;
        
        if (mouseInteraction && isMouseEffectActive) {
          // パーティクルとマウス位置の距離を計算
          const dx = x - mousePosition3D.x;
          const dy = y - mousePosition3D.y;
          const mouseDistance = Math.sqrt(dx * dx + dy * dy);
          
          // 影響範囲内の場合のみ力を適用
          if (mouseDistance < mouseRadius) {
            // 距離に基づいて力を計算（近いほど強い）
            const force = (1 - mouseDistance / mouseRadius) * mouseForce;
            
            // 方向ベクトルを計算
            const dirX = mouseDistance > 0.001 ? dx / mouseDistance : 0;
            const dirY = mouseDistance > 0.001 ? dy / mouseDistance : 0;
            
            // 押しのけるか引き寄せるかのモード
            const directionFactor = repelMode ? 1 : -1;
            
            // ランダム要素を加えて自然な動きに
            const randomFactor = 0.8 + Math.random() * 0.4;
            
            // 速度に力を適用
            mouseEffectX = dirX * force * randomFactor * directionFactor;
            mouseEffectY = dirY * force * randomFactor * directionFactor;
          }
        }
        
        // 全ての力を合計して位置を更新
        positionAttribute.setX(i, x + velocities[vIdx] + returnX + wobbleX + mouseEffectX);
        positionAttribute.setY(i, y + velocities[vIdx + 1] + returnY + wobbleY + mouseEffectY);
        
        // 軌道速度も微妙に変動させる
        const speedVariation = 1.0 + (Math.sin(currentTime * 0.3 + i * 0.02) * 0.05); // ±5%の変動
        
        // 摩擦を適用
        velocities[vIdx] = (-y * settings.orbitSpeed * speedVariation) * friction;
        velocities[vIdx + 1] = (x * settings.orbitSpeed * speedVariation) * friction;
      }
    }

    // === Fox Morphing: morphingが有効な場合は座標を補間 ===
    if (morphing && gearPositions) {
      // morph速度を遅く
      morphProgress = Math.min(1, morphProgress + 0.002);
      // morph: count or gearPositions (whichever is smaller), adjusted for startIdx
      const morphCount = Math.min(count, gearPositions.length / 3 - startIdx);
      for (let i = 0; i < morphCount; i++) {
        const gi = startIdx + i;
        const fx = gearPositions[gi * 3] ?? 0;
        const fy = gearPositions[gi * 3 + 1] ?? 0;
        const fz = gearPositions[gi * 3 + 2] ?? 0;
        const nx = THREE.MathUtils.lerp(positionAttribute.getX(i), fx, morphProgress);
        const ny = THREE.MathUtils.lerp(positionAttribute.getY(i), fy, morphProgress);
        const nz = THREE.MathUtils.lerp(positionAttribute.getZ(i), fz, morphProgress);
        positionAttribute.setXYZ(i, nx, ny, nz);
      }
      // morph終端で止めて物理挙動も完全に静止
      if (morphProgress >= 1) {
        morphing = false;
        freezeMotion = true;
      }
    }
    
    positionAttribute.needsUpdate = true;
  }

  // デバッグメッセージ
  console.log("Animation loop started");

  // ウィンドウリサイズ時の処理
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', onResize);

  // アニメーションを開始
  animate();

  // クリーンアップ関数を返す
  return () => {
    window.removeEventListener('resize', onResize);
    
    // マウスイベントリスナーの削除
    if (mouseInteraction) {
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseleave', onMouseLeave);
      renderer.domElement.removeEventListener('mouseenter', onMouseEnter);
    }
    
    targetContainer.removeChild(renderer.domElement);
    
    // リソースを解放
    particleSystems.forEach(system => {
      system.geometry.dispose();
      if (Array.isArray(system.material)) {
        system.material.forEach(mat => mat.dispose());
      } else {
        system.material.dispose();
      }
      scene.remove(system);
    });
    
    renderer.dispose();
    
    if (debugMode && mouseHelper) {
      scene.remove(mouseHelper);
    }
    // 追加: morphボタンの削除
    if (morphButton.parentNode) morphButton.parentNode.removeChild(morphButton);
  };
}
// Three.jsを使った複数の揺らいだ円 - 互いに素の振幅で同調を防ぐ
import * as THREE from 'three';

// CircleSettings型の定義
interface CircleSettings {
  radius: number;
  wobblePeriod: number;
  radiusVariation: number;
  wobbleAmplitude: number;
  particlesPerCircle: number;
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
  
  // オプションの初期化
  const mouseInteraction = options?.mouseInteraction !== undefined ? options.mouseInteraction : true;
  const mouseForce = options?.mouseForce !== undefined ? options.mouseForce : 0.05;
  const mouseRadius = options?.mouseRadius !== undefined ? options.mouseRadius : 2.0;
  const repelMode = options?.repelMode !== undefined ? options.repelMode : true;
  const friction = options?.friction !== undefined ? options.friction : 0.98;
  const returnSpeedFactor = options?.returnSpeed !== undefined ? options.returnSpeed : 1.0;
  const debugMode = options?.debug !== undefined ? options.debug : false;
  
  // 基本的な設定
  const particleCount = 3000; // パーティクル数
  const baseRadius = options?.baseRadius !== undefined ? options.baseRadius : 8; // 基本半径
  const circleCount = options?.circleCount !== undefined ? options.circleCount : 5; // 円の数
  const particleSize = 0.04; // 基本パーティクルサイズ
  const orbitSpeed = options?.orbitSpeed !== undefined ? options.orbitSpeed : 0.0004; // 軌道の速度
  const wobbleStrength = options?.wobbleStrength !== undefined ? options.wobbleStrength : 0.008; // ブレの基本強さ - 半径が同じなので強く
  
  // 互いに素の数の代わりに、明示的に5つの円の振幅と周波数を設定
  const explicitCircleSettings = [
    { wobblePeriod: 0.02, radiusVariation: 0.031, wobbleAmplitude: 1.2 }, // 円1: 速い周期、小さい振幅
    { wobblePeriod: 0.03, radiusVariation: 0.043, wobbleAmplitude: 0.8 }, // 円2: やや速い周期、中程度の振幅
    { wobblePeriod: 0.05, radiusVariation: 0.059, wobbleAmplitude: 1.5 }, // 円3: 中程度の周期、大きい振幅
    { wobblePeriod: 0.07, radiusVariation: 0.067, wobbleAmplitude: 0.7 }, // 円4: やや遅い周期、小さい振幅
    { wobblePeriod: 0.11, radiusVariation: 0.071, wobbleAmplitude: 1.0 }  // 円5: 遅い周期、中程度の振幅
  ];
  
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
    
    circleSettings.push({
      radius,
      wobblePeriod,
      radiusVariation,
      wobbleAmplitude,
      particlesPerCircle: Math.floor(particleCount / circleCount)
    });
  }
  
  // シーンの初期化
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xECF0F1); // アルカサイトの背景色
  
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
      const waveOffset = Math.sin(angle * settings.radiusVariation) * radius * 0.15;
      const randomOffset = (Math.random() - 0.5) * radius * 0.05; // ランダムなノイズを追加
      
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
      velocities[i * 3] = -y * orbitSpeed * (0.8 + Math.random() * 0.4);
      velocities[i * 3 + 1] = x * orbitSpeed * (0.8 + Math.random() * 0.4);
      velocities[i * 3 + 2] = 0;
      
      // パーティクルごとにブレの係数を設定 - 各円に個別の振幅を適用
      wobbleFactors[i] = wobbleStrength * settings.wobbleAmplitude * (0.9 + Math.random() * 0.2);
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
    for (let c = 0; c < particleSystems.length; c++) {
      updateParticles(particleSystems[c], particlesData[c], time);
    }
    
    // レンダリング
    renderer.render(scene, camera);
  }
  
  // パーティクルの位置を更新する関数
  function updateParticles(
    particleSystem: THREE.Points, 
    data: ParticleData, 
    currentTime: number
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
    
    for (let i = 0; i < count; i++) {
      // 現在の位置を取得
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i);
      
      // 初期位置を取得
      const initialX = initialPositionAttribute.getX(i);
      const initialY = initialPositionAttribute.getY(i);
      
      // 中心からの距離を計算
      const distance = Math.sqrt(x * x + y * y);
      
      // 理想的な距離からのずれを計算（元の円軌道に戻る力）
      const idealRadius = Math.sqrt(initialX * initialX + initialY * initialY);
      const radiusDiff = idealRadius - distance;
      
      // 理想的な半径に戻る力
      const returnForce = 0.015 * returnSpeedFactor;
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
      velocities[vIdx] = (-y * orbitSpeed * speedVariation) * friction;
      velocities[vIdx + 1] = (x * orbitSpeed * speedVariation) * friction;
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
  };
}
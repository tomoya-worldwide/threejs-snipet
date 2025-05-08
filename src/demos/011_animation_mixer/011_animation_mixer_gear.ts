import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'lil-gui';

// 必要なアセットのインポート
import foxAsset from './gear.glb?url';
import ballAsset from './untitled2.glb?url';

export default async function init(): Promise<void> {
    // 基本セットアップ
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(4, 2, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // 設定可能なパラメータ
    const params = {
        backgroundColor: '#000033',
        modelColor: '#000033',
        particleCount: 60000,
        resetAnimation: () => {},
        regenerateParticles: () => {}
    };

    // 背景色を設定
    scene.background = new THREE.Color(params.backgroundColor);

    // モデルの読み込み
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(foxAsset); // ギアモデル
    const gltf2 = await loader.loadAsync(ballAsset); // 球体モデル

    // 背景色と同じ色のマテリアルを作成
    const backgroundMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(params.modelColor),
        transparent: true,
        opacity: 1.0,
    });

    // ギアモデルを背景に溶け込ませる
    gltf.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            obj.material = backgroundMaterial;
        }
    });

    // 球体モデルも非表示に
    gltf2.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            obj.visible = false;
        }
    });

    // シーンには追加するが、表示はされない（三角形計算のため）
    scene.add(gltf.scene);
    scene.add(gltf2.scene);

    // パーティクル関連の変数
    let sphereMesh: THREE.Mesh | null = null;
    let numParticles = params.particleCount;
    let initialPositions: Float32Array | null = null;
    let scales: Float32Array | null = null; // パーティクルのスケール値を保存
    let rotations: Float32Array | null = null; // パーティクルの回転値を保存
    let morphProgress = 0;
    let particleSystem: THREE.InstancedMesh | null = null;
    let particleMaterial: THREE.MeshBasicMaterial;

    // 球体メッシュを取得
    gltf2.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            sphereMesh = obj;
        }
    });

    let animateParticles: ((delta: number) => void) | null = null;

    // パーティクルを生成する関数
    function generateParticles() {
        // 既存のパーティクルシステムを削除
        if (particleSystem) {
            scene.remove(particleSystem);
            particleSystem.dispose();
        }

        if (sphereMesh) {
            // パーティクル数を現在の設定から取得
            numParticles = params.particleCount;

            // 球体の半径を取得
            let sphereRadius: number;
            if (sphereMesh.geometry.boundingSphere) {
                sphereRadius = sphereMesh.geometry.boundingSphere.radius;
            } else if (sphereMesh.geometry.boundingBox) {
                sphereRadius = sphereMesh.geometry.boundingBox.getSize(new THREE.Vector3()).x * 0.5;
            } else {
                sphereRadius = 1;
            }

            // 球面上のパーティクル位置を生成
            const positions = new Float32Array(numParticles * 3);
            scales = new Float32Array(numParticles);
            rotations = new Float32Array(numParticles * 3);

            for (let i = 0; i < numParticles; i++) {
                // 球面上の一様分布サンプリング
                const u = Math.random();
                const v = Math.random();
                const theta = 2 * Math.PI * u;
                const phi = Math.acos(2 * v - 1);

                positions[i * 3 + 0] = sphereRadius * Math.sin(phi) * Math.cos(theta);
                positions[i * 3 + 1] = sphereRadius * Math.sin(phi) * Math.sin(theta);
                positions[i * 3 + 2] = sphereRadius * Math.cos(phi);

                // パーティクルスケール - 一貫性のために保存
                scales[i] = 0.8 + Math.random() * 0.4;

                // ランダムな回転を保存
                rotations[i * 3 + 0] = Math.random() * Math.PI * 2;
                rotations[i * 3 + 1] = Math.random() * Math.PI * 2;
                rotations[i * 3 + 2] = Math.random() * Math.PI * 2;
            }

            // 三角形のパーティクルジオメトリを作成
            const particleGeometry = new THREE.BufferGeometry();
            // 三角形の頂点を定義
            const vertices = new Float32Array([
                0, 0.01, 0,      // 頂点1 - 上
                -0.0087, -0.005, 0,  // 頂点2 - 左下
                0.0087, -0.005, 0    // 頂点3 - 右下
            ]);

            // 頂点情報をジオメトリに追加
            particleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

            // パーティクルマテリアル - MeshBasicMaterial
            particleMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.8,
            });

            // インスタンス化メッシュの作成
            particleSystem = new THREE.InstancedMesh(particleGeometry, particleMaterial, numParticles);

            // 各インスタンスの変換行列を設定
            const dummy = new THREE.Object3D();

            for (let i = 0; i < numParticles; i++) {
                dummy.position.set(positions[i * 3 + 0], positions[i * 3 + 1], positions[i * 3 + 2]);

                // 保存した回転を使用
                dummy.rotation.set(rotations[i * 3 + 0], rotations[i * 3 + 1], rotations[i * 3 + 2]);

                // 保存したスケール値を使用
                dummy.scale.set(scales[i], scales[i], scales[i]);

                dummy.updateMatrix();
                particleSystem.setMatrixAt(i, dummy.matrix);
            }

            particleSystem.instanceMatrix.needsUpdate = true;
            scene.add(particleSystem);

            // 初期位置を保存
            initialPositions = new Float32Array(positions);

            // ギアモデルの三角形を収集
            const foxTriangles: {
                vertices: THREE.Vector3[];
                area: number;
            }[] = [];
            let totalArea = 0;

            gltf.scene.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                    const m = obj;
                    const geo = m.geometry;

                    // ジオメトリから頂点情報を取得
                    const posA = geo.getAttribute('position') as THREE.BufferAttribute;

                    // インデックス付きジオメトリの場合
                    if (geo.index) {
                        const indices = geo.index;
                        for (let i = 0; i < indices.count; i += 3) {
                            const a = new THREE.Vector3().fromBufferAttribute(posA, indices.getX(i)).applyMatrix4(m.matrixWorld);
                            const b = new THREE.Vector3().fromBufferAttribute(posA, indices.getX(i + 1)).applyMatrix4(m.matrixWorld);
                            const c = new THREE.Vector3().fromBufferAttribute(posA, indices.getX(i + 2)).applyMatrix4(m.matrixWorld);

                            // 三角形の面積を計算
                            const ab = new THREE.Vector3().subVectors(b, a);
                            const ac = new THREE.Vector3().subVectors(c, a);
                            const cross = new THREE.Vector3().crossVectors(ab, ac);
                            const area = cross.length() * 0.5;

                            if (area > 0.000001) {
                                // 面積がゼロに近い三角形を除外
                                foxTriangles.push({
                                    vertices: [a, b, c],
                                    area: area,
                                });
                                totalArea += area;
                            }
                        }
                    } else {
                        // 非インデックスジオメトリの場合
                        for (let i = 0; i < posA.count; i += 3) {
                            const a = new THREE.Vector3().fromBufferAttribute(posA, i).applyMatrix4(m.matrixWorld);
                            const b = new THREE.Vector3().fromBufferAttribute(posA, i + 1).applyMatrix4(m.matrixWorld);
                            const c = new THREE.Vector3().fromBufferAttribute(posA, i + 2).applyMatrix4(m.matrixWorld);

                            // 三角形の面積を計算
                            const ab = new THREE.Vector3().subVectors(b, a);
                            const ac = new THREE.Vector3().subVectors(c, a);
                            const cross = new THREE.Vector3().crossVectors(ab, ac);
                            const area = cross.length() * 0.5;

                            if (area > 0.000001) {
                                // 面積がゼロに近い三角形を除外
                                foxTriangles.push({
                                    vertices: [a, b, c],
                                    area: area,
                                });
                                totalArea += area;
                            }
                        }
                    }
                }
            });

            console.log(`Collected ${foxTriangles.length} triangles from the model`);

            // ターゲット位置の構築（三角形面積に基づくサンプリング）
            const targetPositions = new Float32Array(numParticles * 3);
            for (let i = 0; i < numParticles; i++) {
                // 三角形をランダムに選択（面積に比例）
                let randomArea = Math.random() * totalArea;
                let cumulativeArea = 0;
                let selectedTriangle = null;

                for (let j = 0; j < foxTriangles.length; j++) {
                    cumulativeArea += foxTriangles[j].area;
                    if (randomArea <= cumulativeArea) {
                        selectedTriangle = foxTriangles[j];
                        break;
                    }
                }

                if (!selectedTriangle) {
                    // 万が一選択されなかった場合は最後の三角形を使用
                    selectedTriangle = foxTriangles[foxTriangles.length - 1];
                }

                // 三角形上のランダムな点を生成（重心座標を使用）
                // 重心座標の生成
                let u = Math.random();
                let v = Math.random();

                // 均一分布するための調整（正しい三角形サンプリング）
                if (u + v > 1) {
                    u = 1 - u;
                    v = 1 - v;
                }

                const w = 1 - u - v;
                const [a, b, c] = selectedTriangle.vertices;

                // 選択した三角形上の点を計算
                const x = a.x * u + b.x * v + c.x * w;
                const y = a.y * u + b.y * v + c.y * w;
                const z = a.z * u + b.z * v + c.z * w;

                targetPositions[i * 3 + 0] = x;
                targetPositions[i * 3 + 1] = y;
                targetPositions[i * 3 + 2] = z;
            }

            // ターゲット位置のスケーリングと中心合わせ
            const box = new THREE.Box3();
            box.setFromArray(targetPositions);
            const sizeBox = new THREE.Vector3();
            box.getSize(sizeBox);
            const maxDim = Math.max(sizeBox.x, sizeBox.y, sizeBox.z);
            const scaleFactor = (sphereRadius * 2) / maxDim;
            for (let i = 0; i < targetPositions.length; i++) {
                targetPositions[i] *= scaleFactor;
            }

            // 中心位置を調整
            box.setFromArray(targetPositions);
            const center = new THREE.Vector3();
            box.getCenter(center);
            for (let i = 0; i < numParticles; i++) {
                targetPositions[i * 3 + 0] -= center.x;
                targetPositions[i * 3 + 1] -= center.y;
                targetPositions[i * 3 + 2] -= center.z;
            }

            // アニメーション処理関数
            morphProgress = 0;
            const morphSpeed = 0.25;
            const dummyObj = new THREE.Object3D();

            animateParticles = (delta: number): void => {
                if (morphProgress < 1 && particleSystem) {
                    morphProgress = Math.min(1, morphProgress + morphSpeed * delta);
                    const t = morphProgress;
                    const it = 1 - t;

                    for (let i = 0; i < numParticles; i++) {
                        const ix = i * 3;

                        // 位置の線形補間
                        const newX = initialPositions![ix + 0] * it + targetPositions[ix + 0] * t;
                        const newY = initialPositions![ix + 1] * it + targetPositions[ix + 1] * t;
                        const newZ = initialPositions![ix + 2] * it + targetPositions[ix + 2] * t;

                        // ダミーオブジェクトに適用
                        dummyObj.position.set(newX, newY, newZ);

                        // 保存された回転を適用
                        dummyObj.rotation.set(rotations![i * 3 + 0], rotations![i * 3 + 1], rotations![i * 3 + 2]);

                        // 保存されたスケールを使用
                        dummyObj.scale.set(scales![i], scales![i], scales![i]);

                        // 行列を更新
                        dummyObj.updateMatrix();
                        particleSystem.setMatrixAt(i, dummyObj.matrix);
                    }

                    // インスタンス行列の更新フラグを設定
                    particleSystem.instanceMatrix.needsUpdate = true;
                }
            };

            // リセット関数を更新
            params.resetAnimation = () => {
                if (initialPositions && particleSystem && rotations && scales) {
                    morphProgress = 0;

                    const dummy = new THREE.Object3D();
                    for (let i = 0; i < numParticles; i++) {
                        const ix = i * 3;
                        dummy.position.set(initialPositions[ix + 0], initialPositions[ix + 1], initialPositions[ix + 2]);

                        // 保存された回転を適用
                        dummy.rotation.set(rotations[i * 3 + 0], rotations[i * 3 + 1], rotations[i * 3 + 2]);

                        // 保存されたスケールを使用
                        dummy.scale.set(scales[i], scales[i], scales[i]);

                        dummy.updateMatrix();
                        particleSystem.setMatrixAt(i, dummy.matrix);
                    }

                    particleSystem.instanceMatrix.needsUpdate = true;
                }
            };
        }
    }

    // モデルのスケーリングと位置調整
    gltf.scene.scale.set(0.19, 0.19, 0.19);
    gltf.scene.position.set(0, -0.374, 0);
    controls.target.set(0, 0.4, 0);

    // ライティング設定
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemi.position.set(0, 5, 0);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 5, 2);
    scene.add(dir);

    // 初期パーティクルの生成
    params.regenerateParticles = generateParticles;
    generateParticles();

    // GUIコントロール
    const gui = new GUI();
    
    // 背景色コントロール
    gui.addColor(params, 'backgroundColor').name('背景色').onChange((value: string) => {
        scene.background = new THREE.Color(value);
    });
    
    // モデル色コントロール
    gui.addColor(params, 'modelColor').name('モデル色').onChange((value: string) => {
        backgroundMaterial.color.set(value);
    });
    
    // パーティクル数コントロール
    gui.add(params, 'particleCount', 10000, 1000000, 10000).name('パーティクル数');
    gui.add(params, 'regenerateParticles').name('パーティクル再生成');
    gui.add(params, 'resetAnimation').name('アニメーションリセット');

    // リサイズ対応
    window.addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });

    // アニメーションループ
    const clock = new THREE.Clock();
    function tick(): void {
        const delta = clock.getDelta();

        if (animateParticles) animateParticles(delta);

        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(tick);
    }
    tick();
}
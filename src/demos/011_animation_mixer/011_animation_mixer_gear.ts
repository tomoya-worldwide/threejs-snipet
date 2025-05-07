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

    // 背景色を濃い青に設定
    scene.background = new THREE.Color(0x000033);

    // モデルの読み込み
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(foxAsset);    // ギアモデル
    const gltf2 = await loader.loadAsync(ballAsset);  // 球体モデル

    scene.add(gltf.scene);
    scene.add(gltf2.scene);

    // パーティクル関連の変数
    let sphereMesh: THREE.Mesh | null = null;
    let particleGeometry: THREE.BufferGeometry | null = null;
    let numParticles = 0;
    let initialPositions: Float32Array | null = null;
    let morphProgress = 0;

    // 球体メッシュを取得
    gltf2.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            sphereMesh = obj;
        }
    });

    let animateParticles: ((delta: number) => void) | null = null;

    if (sphereMesh) {
        // 元の球体を非表示
        const mesh = sphereMesh as THREE.Mesh;
        mesh.visible = false;

        // パーティクル数
        numParticles = 20000;

        // 球体の半径を取得
        let sphereRadius: number;
        if (mesh.geometry.boundingSphere) {
            sphereRadius = mesh.geometry.boundingSphere.radius;
        } else if (mesh.geometry.boundingBox) {
            sphereRadius = mesh.geometry.boundingBox.getSize(new THREE.Vector3()).x * 0.5;
        } else {
            sphereRadius = 1;
        }

        // 球面上のパーティクル位置を生成
        const positions = new Float32Array(numParticles * 3);
        const sizes = new Float32Array(numParticles);

        for (let i = 0; i < numParticles; i++) {
            // 球面上の一様分布サンプリング
            const u = Math.random();
            const v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);

            positions[i * 3 + 0] = sphereRadius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = sphereRadius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = sphereRadius * Math.cos(phi);

            // パーティクルサイズ
            sizes[i] = 0.01 + Math.random() * 0.01; // 少し小さくて変化のあるサイズ
        }

        // パーティクルジオメトリ作成
        particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // パーティクルマテリアル - シンプルな設定
        const particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.02,
            sizeAttenuation: true
        });

        // サイズ属性を使用するためのシェーダー修正
        particleMaterial.onBeforeCompile = function (shader) {
            const vertexShader = shader.vertexShader;
            shader.vertexShader = vertexShader
                .replace('uniform float size;', 'attribute float size;')
                .replace('gl_PointSize = size;', 'gl_PointSize = size * 1.5;');
        };

        // パーティクルシステム作成
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);

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

        // 位置属性への参照
        const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;

        // アニメーション処理関数
        morphProgress = 0;
        const morphSpeed = 0.25;

        animateParticles = (delta: number): void => {
            if (morphProgress < 1) {
                morphProgress = Math.min(1, morphProgress + morphSpeed * delta);
                const t = morphProgress;
                const it = 1 - t;
                
                for (let i = 0; i < numParticles; i++) {
                    const ix = i * 3;
                    posAttr.array[ix + 0] = initialPositions![ix + 0] * it + targetPositions[ix + 0] * t;
                    posAttr.array[ix + 1] = initialPositions![ix + 1] * it + targetPositions[ix + 1] * t;
                    posAttr.array[ix + 2] = initialPositions![ix + 2] * it + targetPositions[ix + 2] * t;
                }
                posAttr.needsUpdate = true;
            }
        };
    }

    // モデルのスケーリングと位置調整
    gltf.scene.scale.set(0.02, 0.02, 0.02);
    gltf.scene.position.set(0, 0, 0);
    controls.target.set(0, 0.4, 0);

    // ライティング設定
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemi.position.set(0, 5, 0);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 5, 2);
    scene.add(dir);

    // GUIコントロール
    const gui = new GUI();
    const params = {
        resetAnimation: () => {
            if (particleGeometry && initialPositions) {
                const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
                for (let i = 0; i < numParticles; i++) {
                    const ix = i * 3;
                    posAttr.array[ix + 0] = initialPositions[ix + 0];
                    posAttr.array[ix + 1] = initialPositions[ix + 1];
                    posAttr.array[ix + 2] = initialPositions[ix + 2];
                }
                posAttr.needsUpdate = true;
                morphProgress = 0;
            }
        }
    };

    gui.add(params, 'resetAnimation').name('Reset Animation');

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
//
// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

function loadTextureAtlasAndLayerGeometries() {
  const baseUrl =
      'https://storage.googleapis.com/immersive-lf-video-siggraph2020/welder/lmta';

  const atlasUrl = baseUrl + '/texture_atlas_rgba.png';
  const textureLoader = new THREE.TextureLoader();
  const texturePromise =
      new Promise((resolve, reject) => textureLoader.load(atlasUrl, texture => {
        texture.generateMipmaps = false;
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        resolve(texture);
      }, undefined, () => reject(new ReferenceError(atlasUrl))));

  const geometryUrls = [];
  const NUM_LAYERS = 16;
  for (let i = 0; i < NUM_LAYERS; ++i) {
    geometryUrls.push(
        baseUrl + '/mdi_rig_space_mesh_' + i.toString().padStart(3, '0') +
        '.ply');
  }

  const plyLoader = new THREE.PLYLoader();
  const geometryPromises = geometryUrls.map(
      url => new Promise(
          (resolve, reject) =>
              plyLoader.load(url, geometry => resolve(geometry))));

  return Promise.all([texturePromise].concat(geometryPromises));
}

function setupScene(textureAtlas, layerGeometries) {
  const material = new THREE.ShaderMaterial({
    vertexShader: `
  varying vec2 vTexCoords;
  void main() {
    vec4 pos = vec4(position, 1.0);
    // Perform cv -> gl transform for LMIs and LMDIs.
    vTexCoords = vec2(uv.x, 1.0 - uv.y);
    pos.yz *= vec2(-1.0);
    gl_Position = projectionMatrix * modelViewMatrix * pos;
  }
`,

    fragmentShader: `
  varying vec2 vTexCoords;
  uniform sampler2D atlas;

  void main() {
    gl_FragColor = texture2D(atlas, vTexCoords);
    // TODO(rover): remove premult.
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`,

    uniforms: {'atlas': {'value': textureAtlas}},
  });
  material.blending = THREE.CustomBlending;
  material.blendEquation = THREE.AddEquation;
  material.blendSrc = THREE.OneFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;

  const scene = new THREE.Scene();
  layerGeometries.map(geometry => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
  });
  return scene;
}

function setupCamera(canvas) {
  const camera = new THREE.PerspectiveCamera(
      72, canvas.clientWidth / canvas.clientHeight, .1, 10000);

  const view = document.getElementById('scene-viewer');
  const BASELINE = 0.7;
  view.addEventListener('wheel', e => {
    const WHEEL_SPEED = .005;
    camera.position.z += WHEEL_SPEED * e.deltaY;
    camera.position.clampLength(0, 0.5 * BASELINE);
    e.preventDefault();
  });

  const LOOKAT_DISTANCE = 2;
  const LOOKAT_POINT = new THREE.Vector3(0, 0, -LOOKAT_DISTANCE);
  view.addEventListener('mousemove', e => {
    const halfBaseline = 0.5 * BASELINE;
    const x = e.offsetX / view.clientWidth;
    const y = e.offsetY / view.clientHeight;
    camera.position.x = -halfBaseline * (2 * x - 1);
    camera.position.y = halfBaseline * (2 * y - 1);
    camera.position.clampLength(0.0, halfBaseline);
    camera.lookAt(LOOKAT_POINT);
  });
  return camera;
}

function setupRenderer(canvas, camera, scene) {
  const renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}

function start() {
  const canvas = document.getElementById('viewer-canvas');

  loadTextureAtlasAndLayerGeometries().then(textureAtlasAndLayerGeometries => {
    const [textureAtlas, ...layerGeometries] = textureAtlasAndLayerGeometries;

    const scene = setupScene(textureAtlas, layerGeometries);

    const camera = setupCamera(canvas);

    setupRenderer(canvas, camera, scene);
  });
}

start();

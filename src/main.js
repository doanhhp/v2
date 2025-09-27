import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'

/* =========================================================
   Vite + GitHub Pages asset helper (project repo safe)
   ========================================================= */
const BASE = import.meta.env.BASE_URL // will be '/8month/' in production
const asset = (p) => BASE + p.replace(/^\//, '') // strip leading '/' and prefix BASE

/* =========================================================
   Debug helper (shows failed image URLs / tips)
   ========================================================= */
function debugToast(msg) {
  let el = document.querySelector('.debug-toast')
  if (!el) {
    el = document.createElement('div')
    el.className = 'debug-toast'
    Object.assign(el.style, {
      position: 'fixed', left: '12px', bottom: '12px', padding: '10px 12px',
      background: 'rgba(0,0,0,.75)', color: '#fff', font: '12px/1.3 system-ui, sans-serif',
      borderRadius: '8px', maxWidth: '60ch', whiteSpace: 'pre-wrap', zIndex: 99999
    })
    document.body.appendChild(el)
  }
  el.textContent = msg
  clearTimeout(debugToast._t)
  debugToast._t = setTimeout(() => el.remove(), 7000)
}

/* =========================================================
   Texture helpers (handle ANY image size + retry loads)
   ========================================================= */
function getTexSize(tex) {
  const img = tex.source?.data || tex.image
  return { width: img?.width || 1, height: img?.height || 1 }
}
const isPOT = (n) => (n & (n - 1)) === 0

function configureTexture(tex, renderer) {
  const { width: w, height: h } = getTexSize(tex)
  const pot = isPOT(w) && isPOT(h)

  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace
  else if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding

  tex.generateMipmaps = pot
  tex.minFilter = pot ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = pot ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  tex.wrapT = pot ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping

  const getMaxAniso = renderer.capabilities.getMaxAnisotropy
  const maxAniso = typeof getMaxAniso === 'function' ? getMaxAniso.call(renderer.capabilities) : 1
  tex.anisotropy = Math.min(8, maxAniso || 1)

  tex.needsUpdate = true
  return { w, h }
}

const cacheBust = (url) => url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now().toString(36)

function loadTextureWithRetry(loader, url, attempts = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (n, u) => {
      loader.load(
        u,
        (tex) => resolve({ tex, url: u }),
        undefined,
        (err) => {
          if (n > 1) attempt(n - 1, cacheBust(url))
          else reject(Object.assign(new Error('Texture load failed'), { cause: err, url }))
        }
      )
    }
    attempt(attempts, url)
  })
}

/* =========================================================
   HERO SCENE (page 1)
   ========================================================= */
const container = document.getElementById('app')
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setClearAlpha(0)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.9
container.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 1000)
scene.add(camera)

const hemi = new THREE.HemisphereLight(0xffffff, 0x404060, 0.7)
const dir = new THREE.DirectionalLight(0xffffff, 5.2)
dir.position.set(5, 8, 5)
dir.castShadow = true
dir.shadow.mapSize.set(1024, 1024)
const ambient = new THREE.AmbientLight(0xffffff, 2.5)
scene.add(hemi, dir, ambient)

const ground = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.ShadowMaterial({ opacity: 0.1 }))
ground.rotation.x = -Math.PI / 2
ground.position.y = 0
ground.receiveShadow = true
scene.add(ground)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.enablePan = false
controls.enableZoom = false

/* Falling ribbons */
const RIBBON_COLORS = [0xffa8d6,0xd7aaff,0xa8e8ff,0xfff2a8,0xb8ffcc]
const ribbonsGroup = new THREE.Group()
scene.add(ribbonsGroup)
function createRibbons(){
  const RIBBON_COUNT = window.devicePixelRatio > 1.5 ? 45 : 35
  const geom = new THREE.PlaneGeometry(0.012, 0.2, 1, 10)
  for (let i=0;i<RIBBON_COUNT;i++){
    const mat = new THREE.MeshStandardMaterial({
      color: RIBBON_COLORS[i % RIBBON_COLORS.length],
      roughness:.65, metalness:0, transparent:true, opacity:.9,
      side:THREE.DoubleSide, depthWrite:false
    })
    const r = new THREE.Mesh(geom, mat)
    r.renderOrder = -1
    r.position.set(THREE.MathUtils.randFloatSpread(12), THREE.MathUtils.randFloat(-0.4, 3.5), THREE.MathUtils.randFloatSpread(8))
    r.rotation.set(
      THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(-10, 10)),
      THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(-40, 40)),
      THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(-180, 180))
    )
    r.userData = {
      speed:    THREE.MathUtils.randFloat(0.28, 0.6),
      swayAmp:  THREE.MathUtils.randFloat(0.04, 0.12),
      swayFreq: THREE.MathUtils.randFloat(0.8, 1.5),
      twist:    THREE.MathUtils.randFloat(0.5, 1.3),
      phase:    Math.random()*Math.PI*2
    }
    ribbonsGroup.add(r)
  }
}
createRibbons()

/* Load model (path via asset helper) */
const loader = new GLTFLoader()
let model
loader.load(asset('models/myModel.glb'),(gltf)=>{
  model = gltf.scene
  model.traverse((o)=>{ if(o.isMesh){ o.castShadow=true; if(o.material && 'roughness' in o.material){ o.material.roughness=.5; o.material.metalness=.1 }}})
  scene.add(model)
  frameToObject(model,{offset:1.2}); model.position.y += .2
  controls.update(); controls.rotateLeft(.2)
}, undefined, (err)=>console.error('[GLB] load error:', err))

function frameToObject(object,{offset=1.25}={}){
  const box = new THREE.Box3().setFromObject(object)
  const size = new THREE.Vector3(); const center = new THREE.Vector3()
  box.getSize(size); box.getCenter(center)
  controls.target.copy(center)
  const maxDim = Math.max(size.x,size.y,size.z)
  const dist = (maxDim/2)/Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)
  const viewDir = new THREE.Vector3(1,.6,1).normalize()
  camera.position.copy(center).add(viewDir.multiplyScalar(dist*offset))
  camera.near = Math.max(.01, dist/100); camera.far = dist*100; camera.updateProjectionMatrix()
  ground.position.y = center.y - size.y/2 - .001
}

/* =========================================================
   GALLERY SCENE (page 3)
   ========================================================= */
const galleryContainer = document.getElementById('gallery-app')
const renderer2 = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
renderer2.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer2.setSize(window.innerWidth, window.innerHeight)
renderer2.setClearAlpha(0)
galleryContainer.appendChild(renderer2.domElement)

const scene2 = new THREE.Scene()
const camera2 = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000)
camera2.position.set(0,0,4)
scene2.add(camera2)

const hemi2 = new THREE.HemisphereLight(0xffffff, 0x404060, 0.7)
const dir2  = new THREE.DirectionalLight(0xffffff, 2.2)
dir2.position.set(2,3,2)
scene2.add(hemi2, dir2)

/* ===== 3D title text: "our memories" (pastel pink, always visible) ===== */
const fontLoader2 = new FontLoader()
fontLoader2.load(
  asset('fonts/helvetiker_regular.typeface.json'),
  (font) => {
    const textGeo = new TextGeometry('our memories', {
      font,
      size: 0.6,
      depth: 0.06,
      curveSegments: 8,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.006,
      bevelOffset: 0,
      bevelSegments: 2
    })
    textGeo.computeBoundingBox()
    textGeo.center()

    const textMat = new THREE.MeshBasicMaterial({ color: 0xffcfe6, toneMapped: false })
    const title = new THREE.Mesh(textGeo, textMat)
    title.position.set(0, 0.15, -0.9)
    title.material.depthTest = false
    title.renderOrder = 999
    scene2.add(title)
    debugToast('3D text loaded ✓')
  },
  undefined,
  (err) => {
    console.error('Font load failed:', err)
    debugToast('Could not load fonts/helvetiker_regular.typeface.json')
  }
)

/* Orbit controls — zoom + pan + mobile-friendly gestures */
const controls2 = new OrbitControls(camera2, renderer2.domElement)
controls2.enableDamping = true
controls2.enableZoom = true
controls2.enablePan = true
controls2.screenSpacePanning = true
controls2.autoRotate = false
controls2.minDistance = 0.8
controls2.maxDistance = 12

// Mobile: allow page to scroll vertically over the canvas with one finger.
renderer2.domElement.style.touchAction = 'pan-y'

// Touch gestures (1-finger rotate, 2-finger dolly+pan)
controls2.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }

// Disable page scroll only while two or more touches are on the canvas
const activeTouches = new Set()
function updateTouchAction() {
  renderer2.domElement.style.touchAction = (activeTouches.size >= 2) ? 'none' : 'pan-y'
}
renderer2.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') { activeTouches.add(e.pointerId); updateTouchAction() }
})
const onTouchEnd = (e) => {
  if (e.pointerType === 'touch') { activeTouches.delete(e.pointerId); updateTouchAction() }
}
renderer2.domElement.addEventListener('pointerup', onTouchEnd)
renderer2.domElement.addEventListener('pointercancel', onTouchEnd)
renderer2.domElement.addEventListener('pointerout', onTouchEnd)

/* ------------ Image sources ------------- */
let IMAGES = [
  'images/pic1.jpeg',
  'images/pic2.jpeg',
  'images/pic3.jpeg',
  'images/pic4.jpeg',
  'images/pic5.jpeg',
  'images/pic6.jpeg',
  'images/pic7.jpeg',
  'images/pic8.jpeg'
].map(asset)

/* Vite auto-import from src/images/* (if present) */
try {
  const viteGlob = import.meta?.glob
  if (typeof viteGlob === 'function') {
    const modules = viteGlob('./src/images/*.{jpg,jpeg,png,webp,gif}', { eager: true, as: 'url' })
    const found = Object.values(modules)
    if (found.length) {
      IMAGES = found // Vite already rewrites URLs for BASE
      console.info('[Gallery] Using Vite auto-imported images from src/images/', found)
    }
  }
} catch { /* not Vite; ignore */ }

/* Thicker frame multipliers */
const FRAME_W = 1.16
const FRAME_H = 1.20

// Loading manager + TextureLoader
const manager2 = new THREE.LoadingManager()
const loaderTex = new THREE.TextureLoader(manager2)

const picsGroup = new THREE.Group()
scene2.add(picsGroup)

/* 8 slots with varied depth */
const slots = [
  { x:-2.4, y: 1.0, z:-3.0, ry:  0.25 },
  { x: 2.1, y: 0.7, z:-0.8, ry: -0.18 },
  { x:-1.3, y: 0.6, z:-3.8, ry:  0.05 },
  { x:-0.5, y:-0.9, z: 0.8, ry: -0.12 },
  { x: 2.6, y: 0.2, z: 1.6, ry:  0.22 },
  { x:-2.5, y:-0.6, z: 0.3, ry: -0.08 },
  { x: 0.9,  y:-0.2, z:-1.6, ry:  0.18 },
  { x:-0.2, y: 2.0, z:-0.4, ry: -0.15 }
]

const clickable = []

/* =========================================================
   Helpers — rectangular frame ring (outer rect with inner hole)
   ========================================================= */
function makeRectFrameGeom(outerW, outerH, innerW, innerH) {
  const shape = new THREE.Shape()
  const hw = outerW / 2, hh = outerH / 2
  shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh)

  const hole = new THREE.Path()
  const hiw = innerW / 2, hih = innerH / 2
  hole.moveTo(-hiw, -hih); hole.lineTo(hiw, -hih); hole.lineTo(hiw, hih); hole.lineTo(-hiw, hih); hole.lineTo(-hiw, -hih)
  shape.holes.push(hole)

  return new THREE.ShapeGeometry(shape)
}

// Load all textures with retry & cache-busting
IMAGES.slice(0, slots.length).forEach((src, i) => {
  loadTextureWithRetry(loaderTex, src, 3).then(({ tex }) => {
    const { w, h } = configureTexture(tex, renderer2)
    const aspect = h ? (w / h) : 1
    const H = 1.2
    const W = H * aspect

    // Photo (front side only; back shows the frame ring)
    const photo = new THREE.Mesh(
      new THREE.PlaneGeometry(1,1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
    )
    photo.material.side = THREE.FrontSide
    photo.scale.set(W, H, 1)

    // Frame ring (double-sided)
    const outerW = W * FRAME_W
    const outerH = H * FRAME_H
    const innerW = W * 1.01
    const innerH = H * 1.01
    const frame = new THREE.Mesh(
      makeRectFrameGeom(outerW, outerH, innerW, innerH),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false })
    )
    frame.position.z = -0.01

    const g = new THREE.Group()
    g.add(frame, photo)

    const s = slots[i]
    g.position.set(s.x, s.y, s.z)
    g.rotation.y = s.ry
    g.userData = {
      baseY: s.y,
      bobAmp: THREE.MathUtils.randFloat(0.02, 0.06),
      bobFreq: THREE.MathUtils.randFloat(0.3, 0.6),
      rotFreq: THREE.MathUtils.randFloat(0.15, 0.35),
      phase: Math.random() * Math.PI * 2
    }

    picsGroup.add(g)
    clickable.push(g)
  }).catch((e) => {
    console.error('Failed to load image:', e.url, e.cause || e)
    debugToast(`Failed to load: ${e.url}\nCheck the path/case and that your build serves this file.`)

    // Placeholder with frame
    const H = 1.2, W = 1.2
    const outerW = W * FRAME_W
    const outerH = H * FRAME_H
    const innerW = W * 1.01
    const innerH = H * 1.01
    const frame = new THREE.Mesh(
      makeRectFrameGeom(outerW, outerH, innerW, innerH),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false })
    )
    frame.position.z = -0.01

    const placeholder = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ color: 0xefefef, toneMapped: false, side: THREE.FrontSide })
    )

    const g = new THREE.Group()
    g.add(frame, placeholder)
    const s = slots[i]
    g.position.set(s.x, s.y, s.z)
    g.rotation.y = s.ry
    picsGroup.add(g)
  })
})

/* Drag-rotate a single picture (mobile-friendly: only start drag if horizontal) */
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let dragCandidate = null, dragging = null, startX = 0, startY = 0, lastX = 0

function setPointerFromEvent(e, dom){
  const rect = dom.getBoundingClientRect()
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
}

function onPointerDown(e){
  setPointerFromEvent(e, renderer2.domElement)
  raycaster.setFromCamera(pointer, camera2)
  const hits = raycaster.intersectObjects(clickable, true)
  if (hits.length){
    let g = hits[0].object
    while (g && g.parent && g.parent !== picsGroup) g = g.parent
    dragCandidate = g
    startX = lastX = e.clientX
    startY = e.clientY
  } else {
    dragCandidate = null
  }
}

function onPointerMove(e){
  if (!dragCandidate && !dragging) return

  const dx = e.clientX - startX
  const dy = e.clientY - startY

  if (!dragging) {
    if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
      dragging = dragCandidate
      controls2.enabled = false
    } else {
      return
    }
  }

  const ddx = e.clientX - lastX
  dragging.rotation.y += ddx * 0.005
  lastX = e.clientX
}

function onPointerUp(){
  dragCandidate = null
  dragging = null
  controls2.enabled = true
}

renderer2.domElement.addEventListener('pointerdown', onPointerDown)
window.addEventListener('pointermove', onPointerMove, { passive: true })
window.addEventListener('pointerup', onPointerUp)

/* ================= Resize + Animate ================= */
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)

  camera2.aspect = window.innerWidth / window.innerHeight
  camera2.updateProjectionMatrix()
  renderer2.setSize(window.innerWidth, window.innerHeight)
})

const clock = new THREE.Clock()
function tick(){
  const dt = clock.getDelta(); const t = clock.elapsedTime

  for(const r of ribbonsGroup.children){
    const u = r.userData
    r.position.y -= u.speed*dt
    r.position.x += Math.sin(t*u.swayFreq + u.phase) * u.swayAmp * dt
    r.rotation.z += u.twist*dt
    if(r.position.y < -0.6){
      r.position.y = THREE.MathUtils.randFloat(1.6, 3.6)
      r.position.x = THREE.MathUtils.randFloatSpread(12)
      r.position.z = THREE.MathUtils.randFloatSpread(8)
      u.phase = Math.random()*Math.PI*2
    }
  }
  controls.update()
  renderer.render(scene, camera)

  for(const g of picsGroup.children){
    const u = g.userData
    if(!u) continue
    g.position.y = u.baseY + Math.sin(t*u.bobFreq + u.phase) * u.bobAmp
    g.rotation.z = Math.sin(t*u.rotFreq + u.phase) * 0.03
  }
  controls2.update()
  renderer2.render(scene2, camera2)

  requestAnimationFrame(tick)
}
tick()

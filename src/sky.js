import { lensRadius } from './accretion.js';

// One deterministic celestial sphere, shared by unobstructed sky and bent rays.
// Generated locally: no tiled or mirrored photograph. The Milky Way is painted once on the graphics card
// at full texture resolution (no upscaled low-res image); the stars are drawn live at screen resolution.
const SKY_WIDTH = 4096, SKY_HEIGHT = 2048;
const SKY_PAINT = `#version 300 es
  precision highp float;
  uniform vec2 uSize;
  uniform bool uLinear;
  out vec4 color;
  float h(vec3 p){p=fract(p*vec3(.1031,.11369,.13787));p+=dot(p,p.yzx+19.19);return fract((p.x+p.y)*p.z);}
  float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*n(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s/.984;}
  float ridge(vec3 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*(1.-abs(2.*n(p)-1.));p=p*2.11+vec3(5.3,1.3,7.7);a*=.5;}return s/.969;}
  void main(){
    vec2 uv=gl_FragCoord.xy/uSize;
    float lon=(uv.x-.5)*6.28318530718, lat=(uv.y-.5)*3.14159265359;
    vec3 d=vec3(sin(lon)*cos(lat),sin(lat),-cos(lon)*cos(lat));
    vec3 N=normalize(vec3(.706,.706,.055)), C=normalize(vec3(-.32,.14,-.937));
    // Galactic latitude, gently warped, and how close this direction is to the galaxy's centre.
    float b=dot(d,N)+(fbm(d*2.6+3.)-.5)*.10;
    float l=dot(d,C);
    float thin=exp(-b*b/.010), thick=exp(-b*b/.060);
    float bulge=pow(max(0.,l),6.)*exp(-b*b/.05);
    // Clumpy star clouds along the disc, with fine structure inside them.
    float clouds=fbm(d*7.+fbm(d*3.)*1.2), fine=fbm(d*28.);
    float light=thin*(.45+1.1*smoothstep(.35,.78,clouds))*(.7+.6*fine)+thick*.20+bulge*1.7;
    light*=.30+.70*pow(max(0.,l*.5+.5),1.5);
    // Dark dust lanes: warped filaments hugging the mid-plane, plus looser dark patches above and below.
    vec3 q=d*5.+vec3(fbm(d*4.),fbm(d*4.+7.),fbm(d*4.+13.))*1.6;
    float lane=exp(-pow(b+.012,2.)/.0035)*smoothstep(.55,.86,ridge(q));
    float patches=smoothstep(.52,.76,fbm(d*11.+2.))*thick*(1.-thin*.5);
    float dust=clamp(lane*.95+patches*.5,0.,.97);
    // Muted colour: amber toward the centre, neutral along the disc, faintly blue toward the far side.
    vec3 tint=mix(vec3(.84,.89,1.),vec3(1.,.97,.92),smoothstep(-.3,.6,l));
    tint=mix(tint,vec3(1.,.82,.63),min(1.,bulge));
    vec3 col=tint*light*(1.-dust);
    col+=vec3(.50,.38,.30)*light*dust*(1.-dust)*.3;
    // A few faint emission clouds along the plane.
    col+=vec3(.85,.45,.48)*smoothstep(.64,.86,fbm(d*9.+31.))*thin*(1.-dust)*.10;
    // Galaxies far beyond ours: small tilted ellipses with a bright nucleus, away from the dusty plane.
    for(int i=0;i<22;i++){
      float fi=float(i);
      vec3 g=normalize(vec3(h(vec3(fi,1,7)),h(vec3(fi,3,9)),h(vec3(fi,5,2)))-.5);
      if(abs(dot(g,N))<.22||dot(d,g)<.995)continue;
      vec3 e1=normalize(cross(g,vec3(.001,1,0))),e2=cross(g,e1);
      float ang=h(vec3(fi,8,8))*6.2832;
      vec3 a1=e1*cos(ang)+e2*sin(ang),a2=cross(g,a1),v=d-g;
      float size=.003+.005*h(vec3(fi,2,4)),squash=.22+.6*h(vec3(fi,6,1));
      float r2=(pow(dot(v,a1),2.)+pow(dot(v,a2)/squash,2.))/(size*size);
      col+=vec3(1.,.91,.8)*(exp(-r2*1.3)*.5+exp(-r2*9.)*1.6)*.9;
    }
    float density=clamp(thin*.85+thick*.25+bulge,0.,1.)*(1.-dust*.9);
    col=col*.07+vec3(.0030,.0034,.0048);
    // Stored as is in a half-float texture. Without one: square-rooted (more precision in the dark tones)
    // with a little dither against banding.
    color=uLinear?vec4(col,density):vec4(sqrt(max(col,0.))+(h(vec3(gl_FragCoord.xy,3.))-.5)/255.,density);
  }`;

const spaceSkyLinear = new WeakMap();
function paintSpaceSky(gl, texture) {
  const compile = (kind, source) => {
    const shader = gl.createShader(kind); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const program = gl.createProgram();
  const shaders = [compile(gl.VERTEX_SHADER, `#version 300 es
    void main(){gl_Position=vec4((gl_VertexID&1)==0?-1.:1.,gl_VertexID<2?-1.:1.,0.,1.);}`),
    compile(gl.FRAGMENT_SHADER, SKY_PAINT)];
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  const previousVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING), blend = gl.isEnabled(gl.BLEND);
  const vao = gl.createVertexArray(), framebuffer = gl.createFramebuffer();
  // Half float keeps the faint sky exact, so smoothing it (mipmaps) never darkens it.
  const linear = !!gl.getExtension('EXT_color_buffer_float');
  if (linear) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, SKY_WIDTH, SKY_HEIGHT, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, SKY_WIDTH, SKY_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  spaceSkyLinear.set(gl, linear);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindVertexArray(vao); gl.disable(gl.BLEND); gl.useProgram(program);
  gl.uniform2f(gl.getUniformLocation(program, 'uSize'), SKY_WIDTH, SKY_HEIGHT);
  gl.uniform1i(gl.getUniformLocation(program, 'uLinear'), linear ? 1 : 0);
  gl.viewport(0, 0, SKY_WIDTH, SKY_HEIGHT);
  // Painted in strips so no single draw keeps the graphics card busy for long.
  gl.enable(gl.SCISSOR_TEST);
  for (let y = 0; y < SKY_HEIGHT; y += 256) { gl.scissor(0, y, SKY_WIDTH, 256); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.flush(); }
  gl.disable(gl.SCISSOR_TEST);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindVertexArray(previousVao); if (blend) gl.enable(gl.BLEND);
  gl.deleteFramebuffer(framebuffer); gl.deleteVertexArray(vao);
  for (const shader of shaders) gl.deleteShader(shader);
  gl.deleteProgram(program);
}

const SPACE_METEOR_COUNT = 10;
function spaceMeteorRandom(n) {
  let v = Math.imul(n ^ 0x6ac690c5, 0x45d9f3b);
  v = Math.imul(v ^ (v >>> 16), 0x45d9f3b);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}
function spaceMeteorEvent(lane, time) {
  const period = 3.75 + spaceMeteorRandom(lane * 37 + 1) * 1.35;
  const offset = lane * .41;
  const cycle = Math.floor((time + offset) / period);
  const seed = cycle * 173 + lane * 4099;
  const start = .24 + spaceMeteorRandom(seed + 13) * .48;
  const duration = 1.16 + spaceMeteorRandom(seed + 29) * .48;
  const age = time + offset - cycle * period - start;
  const progress = age / duration;
  const lon = spaceMeteorRandom(seed + 43) * Math.PI * 2 - Math.PI;
  // A broad shower around the celestial equator still exists in world space.
  const latitude = (spaceMeteorRandom(seed + 71) - .5) * 1.10;
  const axis = [Math.sin(lon) * Math.cos(latitude), Math.sin(latitude), -Math.cos(lon) * Math.cos(latitude)];
  const angle = spaceMeteorRandom(seed + 97) * Math.PI * 2;
  const east = [Math.cos(lon), 0, Math.sin(lon)];
  const north = [-Math.sin(lon) * Math.sin(latitude), Math.cos(latitude), Math.cos(lon) * Math.sin(latitude)];
  const tangent = east.map((v, i) => v * Math.cos(angle) + north[i] * Math.sin(angle));
  const arc = .075 + spaceMeteorRandom(seed + 113) * .09;
  const distance = (progress - .5) * arc;
  const tailLength = .015 + spaceMeteorRandom(seed + 139) * .023;
  const along = d => axis.map((v, i) => v * Math.cos(d) + tangent[i] * Math.sin(d));
  const active = progress > 0 && progress < 1;
  const fade = active ? Math.pow(Math.sin(Math.PI * progress), .75) : 0;
  return {head: along(distance), tail: along(distance - tailLength),
    brightness: fade * (.23 + spaceMeteorRandom(seed + 157) * .15),
    width: .00016 + spaceMeteorRandom(seed + 179) * .00015,
    period, offset, start, duration, cycle};
}

export const SPACE_SKY_GLSL = `
  uniform sampler2D uSpaceSky;
  uniform vec3 uSpaceObserver;
  uniform bool uSpaceSkyLinear;
  uniform vec4 uMeteorHead[${SPACE_METEOR_COUNT}];
  uniform vec4 uMeteorTail[${SPACE_METEOR_COUNT}];
  float skyHash(vec3 p) {p=fract(p*vec3(.1031,.11369,.13787));p+=dot(p,p.yzx+19.19);return fract((p.x+p.y)*p.z);}
  float skyNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(skyHash(i),skyHash(i+vec3(1,0,0)),f.x),mix(skyHash(i+vec3(0,1,0)),skyHash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(skyHash(i+vec3(0,0,1)),skyHash(i+vec3(1,0,1)),f.x),mix(skyHash(i+vec3(0,1,1)),skyHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  // One layer of stars: at most one star per cell of a 3D grid laid over the sphere. More stars where the
  // Milky Way is dense, fewer behind dust. Real star colours, from orange to blue-white.
  // Each star has a fixed small size on the sky, and the pixel's footprint on the sky (dx, dy: how far the
  // ray moves per pixel, bent rays included) decides how it lands on screen. Where gravity stretches the sky,
  // stars stretch into arcs with it; where it squeezes the sky, they shrink and fade together. Brightness
  // per area stays the same everywhere, so stretched parts of the sky never go dark or empty.
  // base is the size of one screen pixel on the unbent sky, so a star has the same size and brightness in
  // every layer that draws the sky, however finely that layer is drawn, and at any zoom.
  // soft (0 sharp, up to about 2.5) widens each star by that many screen pixels for the edge blur, keeping its light.
  vec3 skyStars(vec3 ray, vec3 dx, vec3 dy, vec3 ex, vec3 ey, float base, float soft, float scale, float chance, float gain, bool spikes) {
    vec3 shift=vec3(17.3,-5.1,9.7);
    vec3 cell=floor(ray*scale+shift);
    if(skyHash(cell*.731+scale)>chance)return vec3(0);
    vec3 star=normalize((cell-shift+.3+.4*vec3(skyHash(cell+11.),skyHash(cell+23.),skyHash(cell+37.)))/scale);
    // Only stars whose spot on the sphere lies inside this cell, so none are cut in half at cell edges.
    if(floor(star*scale+shift)!=cell)return vec3(0);
    vec3 v=ray-star;
    vec3 t1=normalize(cross(star,abs(star.y)<.9?vec3(0,1,0):vec3(1,0,0))), t2=cross(star,t1);
    vec2 w=vec2(dot(v,t1),dot(v,t2));
    float a=dot(dx,t1), b=dot(dy,t1), c=dot(dx,t2), e=dot(dy,t2);
    // A star is a soft dot about a third of a screen pixel wide, blurred by the pixel it lands in (the .25
    // term: a pixel's own area), so it never drops between pixels and twinkles as the view moves.
    float s2=.07*base*base, wide=s2+soft*soft*.18*base*base;
    float m11=wide+.25*(a*a+b*b), m12=.25*(a*c+b*e), m22=wide+.25*(c*c+e*e), det=max(m11*m22-m12*m12,1e-30);
    float spread=.5*(w.x*w.x*m22-2.*w.x*w.y*m12+w.y*w.y*m11)/det;
    if(spread>18.)return vec3(0);
    float m=skyHash(cell+53.);
    float light=exp(-spread)*1.6*s2/sqrt(det);
    // The brightest few get short, crisp diffraction spikes along the screen's axes.
    float px=base*.41;
    if(spikes&&m>.84&&soft<.5){
      float x=dot(v,ex)/px,y=dot(v,ey)/px;
      light+=(exp(-abs(x)*.5)*exp(-y*y*4.)+exp(-abs(y)*.5)*exp(-x*x*4.))*(m-.84)*2.2;
    }
    float t=skyHash(cell+71.);
    vec3 tint=t<.16?vec3(1.,.72,.50):t<.42?vec3(1.,.89,.76):t<.80?vec3(.95,.96,1.):vec3(.72,.82,1.);
    return tint*gain*(.18+.82*m*m*m)*light;
  }
  // soft: how out of focus this point is (0 in the middle of the view, rising toward the edges). The sky
  // itself is drawn softer there, so the edge blur needs no layer on top that could leave a seam.
  // worldRay: the sky direction this pixel sees (bent by the black hole when drawn by its layer).
  // starRay: the direction stars are drawn from. The black hole's layer passes the unbent ray: bent, stars get
  // stretched so thin at one distance from the hole that they vanish and leave a dark ring. The Milky Way's
  // glow and dust follow worldRay, so the warp still shows.
  vec3 spaceSky(vec3 worldRay, vec3 starRay, float time, float base, float straightPixel, float soft) {
    vec3 ray = normalize(worldRay);
    vec3 dx = dFdx(ray), dy = dFdy(ray);
    float pixel = max(length(dx), length(dy)) * .62;
    // A finite celestial shell responds to camera translation as well as rotation.
    float b = dot(uSpaceObserver, ray);
    float t = -b + sqrt(max(0., b*b + 6400. - dot(uSpaceObserver,uSpaceObserver)));
    vec3 skyRay = normalize(uSpaceObserver + ray*t);
    vec2 uv = vec2(.5 + atan(skyRay.x, -skyRay.z) / 6.28318530718,
                   .5 + asin(clamp(skyRay.y, -1., 1.)) / 3.14159265359);
    // Explicit LOD keeps tiny distant sources stable through bent-ray derivatives.
    vec4 painted = textureLod(uSpaceSky, uv, soft * .55);
    vec3 result = uSpaceSkyLinear ? painted.rgb : painted.rgb * painted.rgb;
    float density = painted.a;
    // Grain finer than the texture, so star clouds stay detailed up close.
    // Faded out toward the blurred edges. Its average is 1, so fading keeps brightness.
    float grain = skyNoise(skyRay*240.)*.6 + skyNoise(skyRay*610.)*.4;
    result *= mix(1., .78 + .44*grain*density + .22*(1.-density), clamp(1. - soft * .5, 0., 1.));
    vec3 starDir = normalize(starRay), sdx = dFdx(starDir), sdy = dFdy(starDir);
    float sb = dot(uSpaceObserver, starDir);
    vec3 starSky = normalize(uSpaceObserver + starDir * (-sb + sqrt(max(0., sb*sb + 6400. - dot(uSpaceObserver,uSpaceObserver)))));
    vec3 ex = length(sdx) > 1e-7 ? normalize(sdx) : vec3(1,0,0), ey = length(sdy) > 1e-7 ? normalize(sdy) : vec3(0,1,0);
    base = clamp(base, .00015, .004);
    bool spikes = pixel < .003;
    vec3 stars = skyStars(starSky, sdx, sdy, ex, ey, base, soft, 70., .06 + .10*density, 2.4, spikes)
               + skyStars(starSky, sdx, sdy, ex, ey, base, soft, 160., .12 + .35*density, 1.1, false)
               + skyStars(starSky, sdx, sdy, ex, ey, base, soft, 360., .05 + .55*density, .55, false);
    result += stars;
    for (int i = 0; i < ${SPACE_METEOR_COUNT}; ++i) {
      vec4 head = uMeteorHead[i], tail = uMeteorTail[i];
      if (head.w <= .0001 || dot(ray, head.xyz) < .995) continue;
      vec3 span = tail.xyz - head.xyz;
      float t = clamp(dot(ray - head.xyz, span) / max(dot(span, span), .000001), 0., 1.);
      vec3 nearPoint = normalize(mix(head.xyz, tail.xyz, t));
      float d = length(ray - nearPoint);
      float width = max(tail.w, pixel);
      float profile = exp(-d * d / (width * width)) * pow(1. - t, 1.45);
      // Subpixel energy compensation prevents oversized or overly bright streaks.
      float intensity = head.w * min(1., tail.w / max(pixel, .00001));
      result += vec3(.88, .94, 1.) * profile * intensity;
    }
    return result;
  }
`;

// Kept for callers: the sky is painted straight into a texture now, so there is no source canvas to free.
export function releaseSpaceSkyCanvas() {}

const spaceSkyTextures = new WeakMap();
export function configureSpaceSky(program, gl, unit, scene) {
  let texture = spaceSkyTextures.get(gl);
  if (!texture) {
    texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    paintSpaceSky(gl, texture);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    spaceSkyTextures.set(gl, texture);
  }
  const sampler = gl.getUniformLocation(program, 'uSpaceSky');
  const linearLocation = gl.getUniformLocation(program, 'uSpaceSkyLinear');
  const observer = gl.getUniformLocation(program, 'uSpaceObserver');
  const headLocation = gl.getUniformLocation(program, 'uMeteorHead[0]');
  const tailLocation = gl.getUniformLocation(program, 'uMeteorTail[0]');
  const heads = new Float32Array(SPACE_METEOR_COUNT * 4);
  const tails = new Float32Array(SPACE_METEOR_COUNT * 4);
  return time => {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(sampler, unit);
    gl.uniform1i(linearLocation, spaceSkyLinear.get(gl) ? 1 : 0);
    const distance=3.4/Math.max(.5,scene.view.zoom), z=distance*Math.cos(scene.view.pitch);
    gl.uniform3f(observer, scene.view.center[0]+z*Math.sin(scene.view.yaw), scene.view.center[1]+distance*Math.sin(scene.view.pitch), scene.view.center[2]+z*Math.cos(scene.view.yaw));
    for (let i = 0; i < SPACE_METEOR_COUNT; i++) {
      const meteor = spaceMeteorEvent(i, time);
      heads.set([...meteor.head, meteor.brightness], i * 4);
      tails.set([...meteor.tail, meteor.width], i * 4);
    }
    gl.uniform4fv(headLocation, heads); gl.uniform4fv(tailLocation, tails);
  };
}

function spaceSkyMeteorProbe() {
  const event = spaceMeteorEvent(0, 8.5);
  const timeDuring = event.cycle * event.period - event.offset + event.start + event.duration * .52;
  const during = spaceMeteorEvent(0, timeDuring);
  return {timeBefore: event.cycle * event.period - event.offset + event.start - .16,
    timeDuring, yaw: Math.atan2(-during.head[0], -during.head[2]), pitch: -Math.asin(during.head[1])};
}

// scene: {view, time} read on every frame
export function createSkyRenderer(canvas, scene) {
  const gl = canvas.getContext('webgl2', {alpha: false, antialias: false});
  if (!gl) return null;
  const program = gl.createProgram();
  for (const [kind, source] of [
    [gl.VERTEX_SHADER, `#version 300 es
      out vec2 vScreen;
      void main() {
        vec2 corner = vec2((gl_VertexID & 1) == 0 ? -1. : 1., gl_VertexID < 2 ? -1. : 1.);
        vScreen = corner * vec2(1., -1.); gl_Position = vec4(corner, 0., 1.);
      }`],
    [gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      in vec2 vScreen; uniform vec2 uRayScale, uHalf; uniform vec4 uRotation; uniform vec3 uWarp; uniform float uSkyTime;
      out vec4 color;
      ${SPACE_SKY_GLSL}
      // The warp: the sky around the black hole is pulled in toward it and swirled around it.
      // uWarp = the hole's centre on screen (pixels from the middle of the view) and its shadow's radius in
      // pixels (0 when the hole is behind the camera). Everything is measured in shadow radii, so the warp is
      // attached to the hole and looks the same at every zoom.
      // Each pixel shows the sky from a point further out and turned around the hole: further out by a factor
      // that is 2.2 at the hole and eases to 1 far away, turned by up to .6 radians, both fading as
      // 1 / (1 + (distance / 4 radii)^2). The radius it reads from always grows with the pixel's own radius, so
      // the sky is squeezed and swirled but never folds over itself: no part of it is stretched without limit,
      // which is what drew thin rings and empty bands in the earlier warps. One layer, so no edge either.
      vec2 warp(vec2 pixel) {
        if (uWarp.z <= 0.) return pixel;
        vec2 d = pixel - uWarp.xy;
        float fade = 16. / (dot(d, d) / (uWarp.z * uWarp.z) + 16.);
        float turn = .6 * fade, c = cos(turn), s = sin(turn);
        return uWarp.xy + mat2(c, s, -s, c) * d * (1. + 1.2 * fade);
      }
      void main() {
        vec2 pixel = vScreen * uHalf;
        vec3 straight = normalize(vec3(vScreen * uRayScale, -1.));
        float straightPixel = max(length(dFdx(straight)), length(dFdy(straight)));
        vec3 ray = normalize(vec3(warp(pixel) / uHalf * uRayScale, -1.));
        float y = ray.y * uRotation.z + ray.z * uRotation.w;
        float z = ray.z * uRotation.z - ray.y * uRotation.w;
        vec3 world = vec3(ray.x * uRotation.x + z * uRotation.y, y, z * uRotation.x - ray.x * uRotation.y);
        float vignette = 1. - .24 * smoothstep(.15, 1.42, length(vScreen));
        // Edge blur: a circle around the middle of the map stays sharp, and the sky softens beyond it.
        float soft = 2.5 * smoothstep(.6, 1.7, length(vScreen * uHalf) / uHalf.y);
        color = vec4(spaceSky(world, world, uSkyTime, uRayScale.y / uHalf.y, straightPixel, soft) * vignette, 1.);
      }`],
  ]) {
    const shader = gl.createShader(kind); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader); gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  const scale = gl.getUniformLocation(program, 'uRayScale'), rotation = gl.getUniformLocation(program, 'uRotation');
  const timeLocation = gl.getUniformLocation(program, 'uSkyTime');
  const halfLocation = gl.getUniformLocation(program, 'uHalf'), warpLocation = gl.getUniformLocation(program, 'uWarp');
  const updateSky = configureSpaceSky(program, gl, 0, scene);
  let previous = '';
  const render = camera => {
    if (gl.isContextLost()) return false;
    const {width, height, cy, sy, cp, sp} = camera;
    const key = [width, height, cy, sy, cp, sp, scene.view.zoom, ...scene.view.center, window.devicePixelRatio, scene.time].join(',');
    if (key === previous) return true;
    previous = key;
    // Drawn at exactly 2x the screen's pixels and shrunk by the browser by exactly half, which averages each
    // 2x2 block evenly. (An uneven factor like 1.5x samples unevenly, and fine detail shimmers as it moves.)
    // Very large screens get 1x rather than an uneven size.
    const device = window.devicePixelRatio || 1;
    const dpr = width * height * device * device * 4 <= 12e6 ? device * 2 : device;
    const w = Math.max(1, Math.round(width * dpr)), h = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const focal = Math.min(width, height) * .46 * 3.4 * (1 + .10 * (scene.view.zoom - 1));
    gl.useProgram(program); gl.viewport(0, 0, w, h); updateSky(scene.time);
    gl.uniform2f(scale, width / (2 * focal), height / (2 * focal));
    gl.uniform4f(rotation, cy, sy, cp, sp); gl.uniform1f(timeLocation, scene.time);
    gl.uniform2f(halfLocation, width / 2, height / 2);
    // Where the black hole is on screen and how big its shadow is, for the warp (same projection as the map).
    const [hx, hy, hz] = scene.view.center.map(v => -v), rz = hx * sy + hz * cy;
    const depth = 3.4 - (hy * sp + rz * cp), mapFocal = Math.min(width, height) * .46 * scene.view.zoom * 3.4;
    if (depth > .2) gl.uniform3f(warpLocation, (hx * cy - hz * sy) * mapFocal / depth, (hy * cp - rz * sp) * mapFocal / depth, lensRadius * mapFocal / depth);
    else gl.uniform3f(warpLocation, 0, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  };
  render.meteorProbe = spaceSkyMeteorProbe();
  render.gl = gl;
  render.dispose = () => { gl.deleteProgram(program); gl.deleteTexture(spaceSkyTextures.get(gl)); spaceSkyTextures.delete(gl); };
  return render;
}

import{CONFIG as e}from"./config.js";function s(i,n){const t=new i.Scene,r=n.clientWidth/n.clientHeight,a=new i.PerspectiveCamera(e.CAMERA.FOV,r,e.CAMERA.NEAR,e.CAMERA.FAR),o=new i.WebGLRenderer({canvas:n.querySelector("canvas")||void 0,antialias:!1,alpha:!0,powerPreference:"low-power",preserveDrawingBuffer:!1}),l=n.clientWidth>1200?1.5:1,c=Math.min(globalThis.devicePixelRatio||1,l);o.setPixelRatio(c),o.setSize(n.clientWidth,n.clientHeight),o.setClearColor(0,0),o.outputColorSpace=i.SRGBColorSpace,o.toneMapping=i.ACESFilmicToneMapping,o.toneMappingExposure=.8,n.appendChild(o.domElement);try{n.dataset.threeAttached="1",document.dispatchEvent(new CustomEvent("three-attached",{detail:{containerId:n.id||null}}))}catch{}return{scene:t,camera:a,renderer:o}}function v(i,n){const t=new i.DirectionalLight(16777215,e.SUN.INTENSITY);t.position.set(e.SUN.RADIUS,e.SUN.HEIGHT,0),n.add(t);const r=new i.AmbientLight(e.LIGHTING.DAY.AMBIENT_COLOR,e.LIGHTING.DAY.AMBIENT_INTENSITY);return n.add(r),{directionalLight:t,ambientLight:r}}function u(i,n=!1){const t=`
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,r=`
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    uniform vec3 uRayleighColor;
    uniform vec3 uMieColor;
    uniform float uPower;
    uniform float uRayleighIntensity;
    uniform float uMieIntensity;
    uniform float uScatteringStrength;

    void main() {
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - abs(dot(vNormal, viewDirection)), uPower);

      vec3 rayleighScatter = uRayleighColor * fresnel * uRayleighIntensity;
      vec3 mieScatter = uMieColor * fresnel * uMieIntensity;

      vec3 finalColor = (rayleighScatter + mieScatter) * uScatteringStrength;
      float alpha = fresnel * (uRayleighIntensity + uMieIntensity * 0.5);

      gl_FragColor = vec4(finalColor, alpha);
    }
  `,a=new i.ShaderMaterial({vertexShader:t,fragmentShader:r,uniforms:{uRayleighColor:{value:new i.Color(e.ATMOSPHERE.RAYLEIGH_COLOR)},uMieColor:{value:new i.Color(e.ATMOSPHERE.MIE_COLOR)},uPower:{value:e.ATMOSPHERE.FRESNEL_POWER},uRayleighIntensity:{value:e.ATMOSPHERE.RAYLEIGH_INTENSITY},uMieIntensity:{value:e.ATMOSPHERE.MIE_INTENSITY},uScatteringStrength:{value:e.ATMOSPHERE.SCATTERING_STRENGTH}},blending:i.AdditiveBlending,transparent:!0,side:i.BackSide,depthWrite:!1}),o=n?e.EARTH.SEGMENTS_MOBILE:e.EARTH.SEGMENTS;return new i.Mesh(new i.SphereGeometry(e.EARTH.RADIUS*e.ATMOSPHERE.SCALE,o,o),a)}export{u as createAtmosphere,v as setupLighting,s as setupScene};

import{CONFIG as e}from"./config.js";function s(t,i){const n=new t.Scene,r=i.clientWidth/i.clientHeight,a=new t.PerspectiveCamera(e.CAMERA.FOV,r,e.CAMERA.NEAR,e.CAMERA.FAR),o=new t.WebGLRenderer({canvas:i.querySelector("canvas")||void 0,antialias:!1,alpha:!0,powerPreference:"low-power",preserveDrawingBuffer:!1}),l=i.clientWidth>1200?1.5:1,c=Math.min(globalThis.devicePixelRatio||1,l);o.setPixelRatio(c),o.setSize(i.clientWidth,i.clientHeight),o.setClearColor(0,0),o.outputColorSpace=t.SRGBColorSpace,o.toneMapping=t.ACESFilmicToneMapping,o.toneMappingExposure=.8,i.appendChild(o.domElement);try{i.dataset.threeAttached="1",document.dispatchEvent(new CustomEvent("three-attached",{detail:{containerId:i.id||null}}))}catch{}return{scene:n,camera:a,renderer:o}}function v(t,i){const n=new t.DirectionalLight(16777215,e.SUN.INTENSITY);n.position.set(e.SUN.RADIUS,e.SUN.HEIGHT,0),i.add(n);const r=new t.AmbientLight(e.LIGHTING.DAY.AMBIENT_COLOR,e.LIGHTING.DAY.AMBIENT_INTENSITY);return i.add(r),{directionalLight:n,ambientLight:r}}function u(t,i=!1){const n=`
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
  `,a=new t.ShaderMaterial({vertexShader:n,fragmentShader:r,uniforms:{uRayleighColor:{value:new t.Color(e.ATMOSPHERE.RAYLEIGH_COLOR)},uMieColor:{value:new t.Color(e.ATMOSPHERE.MIE_COLOR)},uPower:{value:e.ATMOSPHERE.FRESNEL_POWER},uRayleighIntensity:{value:e.ATMOSPHERE.RAYLEIGH_INTENSITY},uMieIntensity:{value:e.ATMOSPHERE.MIE_INTENSITY},uScatteringStrength:{value:e.ATMOSPHERE.SCATTERING_STRENGTH}},blending:t.AdditiveBlending,transparent:!0,side:t.BackSide,depthWrite:!1}),o=i?e.EARTH.SEGMENTS_MOBILE:e.EARTH.SEGMENTS;return new t.Mesh(new t.SphereGeometry(e.EARTH.RADIUS*e.ATMOSPHERE.SCALE,o,o),a)}export{u as createAtmosphere,v as setupLighting,s as setupScene};

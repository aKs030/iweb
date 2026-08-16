// @ts-check

/**
 * Keeps every Earth shader on one world-space solar direction. Materials retain
 * their vectors, so the frame loop updates GPU uniforms without allocating.
 *
 * @param {any} system
 */
export function updatePhysicalLightingUniforms(system) {
  if (!system.THREE || !system.directionalLight) return;

  const surfaceDirection = system.dayMaterial?.userData?.earthSunDirectionWorld;
  const sunDirection = surfaceDirection || new system.THREE.Vector3();
  sunDirection.copy(system.directionalLight.position);
  if (sunDirection.lengthSq() < 0.000001) sunDirection.set(0, 0, 1);
  sunDirection.normalize();

  const updateObject = object => {
    object?.traverse?.(child => {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(material => {
        material?.uniforms?.earthSunDirectionWorld?.value?.copy?.(sunDirection);
        material?.userData?.cloudShader?.uniforms?.earthSunDirectionWorld?.value?.copy?.(
          sunDirection
        );
        const shadowOffset = material?.userData?.cloudShader?.uniforms?.cloudShadowUvOffset?.value;
        const shadowFactor = material?.userData?.shadowOffsetFactor || 0;
        shadowOffset?.set?.(-sunDirection.x * shadowFactor, sunDirection.y * shadowFactor * 0.55);

        // Update the new Rayleigh/Mie atmosphere sun direction
        if (material?.userData?.isSunTracked && material?.uniforms?.sunDirection?.value) {
          material.uniforms.sunDirection.value.copy(sunDirection);
        }
      });
    });
  };

  updateObject(system.cityGlowGroup);
  updateObject(system.cloudMesh);
  if (system.earthMesh) updateObject(system.earthMesh);
}

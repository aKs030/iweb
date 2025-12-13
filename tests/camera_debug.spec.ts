
import { test, expect } from '@playwright/test';

test('verify real vs virtual camera alignment', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?debug=true');
  await page.waitForTimeout(1000);

  // Scroll to features
  await page.evaluate(() => {
    document.getElementById('features').scrollIntoView();
  });

  // Wait for animation to settle
  await page.waitForTimeout(5000);

  const debugInfo = await page.evaluate(() => {
    const sys = window.threeEarthSystem;
    if (!sys) return { error: 'System not found' };

    const sm = sys.EarthSystemAPI.starManager;
    const realCam = sm.camera;
    const virtCam = sm.virtualCamera;

    // Force update of virtual camera to match current logic
    sm.updateVirtualCamera();

    // Extract matrices
    const toArr = (m) => Array.from(m.elements);

    return {
      real: {
        pos: realCam.position.toArray(),
        rot: realCam.rotation.toArray().slice(0,3),
        quat: realCam.quaternion.toArray(),
        fov: realCam.fov,
        aspect: realCam.aspect,
        zoom: realCam.zoom,
        projection: toArr(realCam.projectionMatrix),
        worldInverse: toArr(realCam.matrixWorldInverse)
      },
      virt: {
        pos: virtCam.position.toArray(),
        rot: virtCam.rotation.toArray().slice(0,3),
        quat: virtCam.quaternion.toArray(),
        fov: virtCam.fov,
        aspect: virtCam.aspect,
        zoom: virtCam.zoom,
        projection: toArr(virtCam.projectionMatrix),
        worldInverse: toArr(virtCam.matrixWorldInverse)
      }
    };
  });

  if (debugInfo.error) {
    console.log(debugInfo.error);
    return;
  }

  const { real, virt } = debugInfo;

  console.log('--- CAMERA COMPARISON ---');
  console.log('POS Diff:',
    Math.abs(real.pos[0] - virt.pos[0]),
    Math.abs(real.pos[1] - virt.pos[1]),
    Math.abs(real.pos[2] - virt.pos[2])
  );

  console.log('Real Pos:', real.pos);
  console.log('Virt Pos:', virt.pos);

  console.log('ROT Diff:',
    Math.abs(real.rot[0] - virt.rot[0]),
    Math.abs(real.rot[1] - virt.rot[1]),
    Math.abs(real.rot[2] - virt.rot[2])
  );

  console.log('FOV:', real.fov, virt.fov);
  console.log('Aspect:', real.aspect, virt.aspect);
  console.log('Zoom:', real.zoom, virt.zoom);
});

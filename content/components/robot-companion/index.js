export * from "./constants/events.js";
export * from "./memory/robot-memory-schema.js";
export * from "./modules/shared-tool-definitions.js";
export { getProfileState } from "./modules/user-identity.js";

let robotModulePromise = null;
let robotInstancePromise = null;

export function loadRobotCompanion() {
  const runtimeModuleUrl = new URL("./robot-companion.js", import.meta.url).href;
  robotModulePromise ||= import(runtimeModuleUrl);
  return robotModulePromise;
}

export async function createRobotCompanion() {
  const { RobotCompanion } = await loadRobotCompanion();
  return new RobotCompanion();
}

export async function initRobotCompanion() {
  if (typeof document === "undefined") return null;
  if (robotInstancePromise) return robotInstancePromise;

  robotInstancePromise = createRobotCompanion()
    .then(async robot => {
      await robot.initialize();
      return robot;
    })
    .catch(error => {
      robotInstancePromise = null;
      throw error;
    });

  return robotInstancePromise;
}

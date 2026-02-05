import type { Mat4, Vec3 } from "./math";
import { mat4, vec3 } from "./math";

export class Camera {
  position: Vec3 = [0, 1.2, 5.0];
  yaw = -Math.PI / 2; // look toward -Z initially
  pitch = 0;

  moveSpeed = 3.0;
  turnSpeed = 1.8;

  private clampPitch() {
    const lim = Math.PI / 2 - 0.01;
    if (this.pitch > lim) this.pitch = lim;
    if (this.pitch < -lim) this.pitch = -lim;
  }

  getForward(): Vec3 {
    const cp = Math.cos(this.pitch);
    return vec3.normalize([
      Math.cos(this.yaw) * cp,
      Math.sin(this.pitch),
      Math.sin(this.yaw) * cp,
    ]);
  }

  getViewMatrix(): Mat4 {
    const f = this.getForward();
    const target: Vec3 = vec3.add(this.position, f);
    return mat4.lookAt(this.position, target, [0, 1, 0]);
  }

  update(keys: Set<string>, dt: number) {
    // rotate camera with arrow keys
    if (keys.has("ArrowLeft")) this.yaw -= this.turnSpeed * dt;
    if (keys.has("ArrowRight")) this.yaw += this.turnSpeed * dt;
    if (keys.has("ArrowUp")) this.pitch += this.turnSpeed * dt;
    if (keys.has("ArrowDown")) this.pitch -= this.turnSpeed * dt;
    this.clampPitch();

    const f = this.getForward();
    const fXZ: Vec3 = vec3.normalize([f[0], 0, f[2]]);
    const right = vec3.normalize(vec3.cross(fXZ, [0, 1, 0]));
    const speed = this.moveSpeed * dt;

    if (keys.has("w") || keys.has("W")) this.position = vec3.add(this.position, vec3.scale(fXZ, speed));
    if (keys.has("s") || keys.has("S")) this.position = vec3.add(this.position, vec3.scale(fXZ, -speed));
    if (keys.has("a") || keys.has("A")) this.position = vec3.add(this.position, vec3.scale(right, -speed));
    if (keys.has("d") || keys.has("D")) this.position = vec3.add(this.position, vec3.scale(right, speed));
    if (keys.has("q") || keys.has("Q")) this.position = vec3.add(this.position, [0, -speed, 0]);
    if (keys.has("e") || keys.has("E")) this.position = vec3.add(this.position, [0, speed, 0]);
  }
}

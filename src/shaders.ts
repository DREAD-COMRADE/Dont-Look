/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Mystery Realm / Harsh Dimension Noise Shader
export const noiseShader = {
  uniforms: {
    time_u: { value: 0 },
    noise_opacity: { value: 0.7 },
    noise_tint: { value: [1.0, 1.0, 1.0] },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time_u;
    uniform float noise_opacity;
    uniform vec3 noise_tint;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.71, 31.17))) * 43758.5453);
    }

    void main() {
      vec2 px = vUv * 500.0;
      float r = rand(px + vec2(time_u * 0.13, 0.0));
      float g = rand(px + vec2(0.0, time_u * 0.17));
      float b = rand(px + vec2(time_u * 0.19, time_u * 0.23));
      
      vec3 noise = vec3(r, g, b) * noise_tint;
      gl_FragColor = vec4(mix(vec3(0.1), noise, noise_opacity), 1.0);
    }
  `
};

// Watcher Distortion Shader (Spatial)
export const watcherShader = {
  uniforms: {
    time_u: { value: 0 },
    dist_intensity: { value: 0.02 },
  },
  vertexShader: `
    uniform float time_u;
    uniform float dist_intensity;
    void main() {
      vec3 pos = position;
      float wave = sin(pos.y * 8.0 + time_u * 6.0) * dist_intensity;
      pos.x += wave;
      pos.z += wave * 0.5;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    void main() {
      gl_FragColor = vec4(0.05, 0.05, 0.07, 1.0);
    }
  `
};

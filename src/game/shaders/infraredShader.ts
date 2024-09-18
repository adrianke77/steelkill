const frag = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 resolution;

varying vec2 outTexCoord;

void main() {
    float intensity = 0.8; // Brightness/intensity adjustment variable inside shader

    vec4 color = texture2D(uMainSampler, outTexCoord);
    
    float average = (color.r + color.g + color.b) / 3.0;

    vec4 infraredColor = vec4(0.0, 0.0, 0.0, color.a);

    if (average > 0.8) {
        infraredColor = vec4(1.0, 0.0, 0.0, color.a); // Red
    } else if (average > 0.65) {
        infraredColor = vec4(1.0, 0.5, 0.0, color.a); // Orange
    } else if (average > 0.55) {
        infraredColor = vec4(0.7, 0.7, 0.0, color.a); // Yellow
    } else if (average > 0.40) {
        infraredColor = vec4(0.5, 0.7, 0.0, color.a); // Yellow-Green
    } else if (average > 0.35) {
        infraredColor = vec4(0.0, 0.7, 0.0, color.a); // Green
    } else if (average > 0.20) {
        infraredColor = vec4(0.0, 0.7, 0.5, color.a); // Green-Blue
    } else if (average > 0.125) {
        infraredColor = vec4(0.0, 0.2, 1.0, color.a); // Blue
    } else {
        infraredColor = vec4(0.0, 0.0, 0.0, color.a); // Black
    }

    // Adjust the brightness/intensity using the intensity variable
    gl_FragColor = vec4(infraredColor.rgb * intensity, infraredColor.a);
}
`;

export class InfraredPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines
  .PostFXPipeline {
  time: number

  constructor(game: Phaser.Game) {
    super({
      game,
      fragShader: frag,
    })
  }
}

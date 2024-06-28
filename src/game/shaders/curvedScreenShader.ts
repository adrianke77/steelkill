const frag = `
precision mediump float;

uniform sampler2D uMainSampler;
varying vec2 outTexCoord;

void main() {
    vec2 uv = outTexCoord;
    uv = uv * 2.0 - 1.0;

    // Parameters for curvature
    float curvature = 0.025;

    // Calculate distance from center
    float dist = length(uv);

    // Apply more curvature towards the corners
    float curveAmount = dist * curvature * dist;

    // Apply the curvature effect
    uv = uv * (1.0 + curveAmount);

    uv = uv * 0.5 + 0.5;
    
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black out-of-bounds areas
    } else {
        vec4 color = texture2D(uMainSampler, uv);
        gl_FragColor = color;
    }
}
`;

export class CurvedScreenPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
	constructor(game: Phaser.Game) {
		super({
			game,
			fragShader: frag,
		});
	}
}
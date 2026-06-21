uniform vec3 uGridColor;
uniform float uLineWidth; // Start with 0.08

varying vec3 vPosition;
varying vec3 vNormal;

void main() {
    // 1. Map the 3D position to 2D face coordinates
    vec3 absN = abs(vNormal);
    vec2 facePos;

    if (absN.x > 0.5) {
        facePos = vPosition.yz; // Y and Z vary on X‑faces
    } else if (absN.y > 0.5) {
        facePos = vPosition.xz; // X and Z vary on Y‑faces
    } else {
        facePos = vPosition.xy; // X and Y vary on Z‑faces
    }

    // 2. Distance to the nearest integer (grid line) in both directions
    vec2 distToLine = abs(fract(facePos + 0.5) - 0.5);

    // 3. Anti‑aliased line thickness (constant in screen space)
    vec2 lineWidth = fwidth(facePos) * uLineWidth;
    vec2 lineMask = 1.0 - smoothstep(vec2(0.0), lineWidth, distToLine);
    float alpha = max(lineMask.x, lineMask.y) * 0.5;

    // 4. Output
    alpha = clamp(alpha, 0.0, 1.0);
    if (alpha < 0.3) discard;
    gl_FragColor = vec4(uGridColor, alpha);
}
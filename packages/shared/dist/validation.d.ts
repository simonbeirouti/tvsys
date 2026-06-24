import { type DisplayCapabilities, type Scene } from "./scene.js";
export interface ValidationResult<T> {
    ok: boolean;
    value?: T;
    errors: string[];
}
export declare const parseJsonMessage: (raw: string) => ValidationResult<unknown>;
export declare const validateScene: (value: unknown) => ValidationResult<Scene>;
export declare const normalizeScene: (scene: Scene) => Scene;
export declare const validateCapabilities: (value: unknown) => value is DisplayCapabilities;
//# sourceMappingURL=validation.d.ts.map
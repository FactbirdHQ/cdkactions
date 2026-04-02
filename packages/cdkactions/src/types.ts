/**
 * A generic string to string map.
 */
export interface StringMap {
  readonly [key: string]: string;
}

/**
 * Configuration for a shell environment.
 */
export interface RunProps {
  readonly shell?: 'bash' | 'pwsh' | 'python' | 'sh' | 'cmd' | 'powershell';
  readonly workingDirectory?: string;
}

/**
 * A defaults configuration block.
 */
export interface DefaultsProps {
  readonly run?: RunProps;
  readonly [key: string]: any;
}

// React Native ships these under Libraries/* (reachable through its exports map)
// but publishes no types for them.

declare module 'react-native/Libraries/Core/Devtools/parseErrorStack' {
  export type StackFrame = {
    methodName: string;
    file: string | null;
    lineNumber: number | null;
    column: number | null;
    collapse?: boolean;
  };
  export default function parseErrorStack(errorStack?: string): StackFrame[];
}

declare module 'react-native/Libraries/Core/Devtools/symbolicateStackTrace' {
  import type {StackFrame} from 'react-native/Libraries/Core/Devtools/parseErrorStack';
  export default function symbolicateStackTrace(
    stack: StackFrame[],
  ): Promise<{stack: StackFrame[]}>;
}

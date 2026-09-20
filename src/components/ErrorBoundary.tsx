import { Component, type ErrorInfo, type ReactNode } from 'react';
import { WordArt } from './WordArt';

/**
 * Top-level error boundary — a designed error state, never a blank white screen
 * or crash (spec 8.2). Catches any render/runtime error in the tree and offers a reload.
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface for debugging; in production this could be shipped to a crash logger.
    console.error('Rhythm Riot crashed:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="app-frame">
          <div className="bg-scene" />
          <div className="screen center" style={{ justifyContent: 'center', gap: 16, zIndex: 1 }}>
            <div style={{ height: 60, width: 280 }}>
              <WordArt text="OOPS" size={44} colors={['#ffd9df', '#ff9db0', '#ff5d73']} />
            </div>
            <div className="subtle center" style={{ maxWidth: 320 }}>
              Something glitched mid-riot. Your saved scores are safe.
            </div>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Restart
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

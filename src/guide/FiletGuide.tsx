import { Component, type ReactNode } from 'react';

/** Un incident dans le guide le fait disparaître, jamais l'écran où l'on travaille. */
export class FiletGuide extends Component<{ children: ReactNode }, { tombe: boolean }> {
  state = { tombe: false };
  static getDerivedStateFromError() { return { tombe: true }; }
  componentDidCatch(erreur: unknown) { console.error('Guide arrêté :', erreur); }
  render() { return this.state.tombe ? null : this.props.children; }
}

/**
 * Tiptap wrapper around the framework-agnostic ProseMirror plugin.
 *
 * This module is published under the `/tiptap` subpath. Tiptap consumers:
 *
 *   import { OutlineNumbering } from '@bwthomas/outline-numbering/tiptap';
 *   import { decimalStrategy } from '@bwthomas/outline-numbering';
 *   new Editor({ extensions: [OutlineNumbering.configure({ strategy: decimalStrategy })] });
 *
 * Raw ProseMirror users do not need to load this file — import
 * `outlineNumberingPlugin` from the package root instead.
 */
import { Extension } from '@tiptap/core';
import {
  OutlineNumberingPluginOptions,
  outlineNumberingPlugin,
} from './plugin';

export type OutlineNumberingOptions = Partial<OutlineNumberingPluginOptions>;

export const OutlineNumbering = Extension.create<OutlineNumberingOptions>({
  name: 'outlineNumbering',

  addOptions() {
    return {};
  },

  addProseMirrorPlugins() {
    return [outlineNumberingPlugin(this.options)];
  },
});

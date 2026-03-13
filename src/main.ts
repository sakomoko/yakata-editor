import './style.css';
import { initEditor, undo, newProject, loadProject, saveProject, exportAsPng } from './editor.ts';
import { loadFromFile } from './persistence.ts';

document.addEventListener('DOMContentLoaded', () => {
  initEditor();

  document.getElementById('btnNew')!.addEventListener('click', newProject);
  document.getElementById('btnUndo')!.addEventListener('click', undo);
  document.getElementById('btnSave')!.addEventListener('click', saveProject);
  document.getElementById('btnPng')!.addEventListener('click', exportAsPng);

  document.getElementById('btnLoad')!.addEventListener('click', () => {
    document.getElementById('fileInput')!.click();
  });

  document.getElementById('fileInput')!.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const rooms = await loadFromFile(file);
      loadProject(rooms);
    } catch {
      alert('ファイルを読み込めませんでした');
    }
    input.value = '';
  });
});

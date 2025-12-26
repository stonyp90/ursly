/**
 * Drag and Drop Enhancements
 * Ensures drag and drop works across the entire app
 */

let globalDragHandlerInitialized = false;

/**
 * Enhanced drag and drop handler that works everywhere
 */
export function createGlobalDragHandler() {
  if (globalDragHandlerInitialized) {
    return; // Already initialized
  }

  globalDragHandlerInitialized = true;

  // Prevent default drag behavior on document to allow drag over anywhere
  document.addEventListener('dragover', (e) => {
    // Only prevent default if not handled by a specific handler
    const target = e.target as HTMLElement;
    if (!target.closest('[data-drag-handler]')) {
      e.preventDefault();
    }
  });

  document.addEventListener('drop', (e) => {
    // Prevent default drop behavior unless handled by specific handlers
    const target = e.target as HTMLElement;
    if (!target.closest('[data-drag-handler]')) {
      // Allow native file drops to work
      e.preventDefault();
    }
  });

  // Enable drag and drop on all draggable elements
  document.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;
    if (target.hasAttribute('draggable')) {
      // Ensure drag is enabled
      target.setAttribute('draggable', 'true');
    }
  });
}

/**
 * Make any element a drop zone
 */
export function makeDropZone(
  element: HTMLElement,
  onDrop: (e: DragEvent) => void,
  onDragOver?: (e: DragEvent) => void,
) {
  element.setAttribute('data-drag-handler', 'true');

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDragOver) {
      onDragOver(e);
    } else {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop(e);
  };

  element.addEventListener('dragover', handleDragOver);
  element.addEventListener('drop', handleDrop);

  return () => {
    element.removeEventListener('dragover', handleDragOver);
    element.removeEventListener('drop', handleDrop);
    element.removeAttribute('data-drag-handler');
  };
}

/**
 * Enhanced file drag handler with visual feedback
 */
export function enhanceFileDrag(
  element: HTMLElement,
  onDragStart: (e: DragEvent) => void,
  onDragEnd?: () => void,
) {
  element.setAttribute('draggable', 'true');

  const handleDragStart = (e: DragEvent) => {
    onDragStart(e);
    // Add visual feedback
    element.classList.add('dragging');
  };

  const handleDragEnd = () => {
    element.classList.remove('dragging');
    if (onDragEnd) {
      onDragEnd();
    }
  };

  element.addEventListener('dragstart', handleDragStart);
  element.addEventListener('dragend', handleDragEnd);

  return () => {
    element.removeEventListener('dragstart', handleDragStart);
    element.removeEventListener('dragend', handleDragEnd);
    element.removeAttribute('draggable');
  };
}


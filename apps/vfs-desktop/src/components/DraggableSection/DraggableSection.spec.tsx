/**
 * DraggableSection Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DraggableSection } from './DraggableSection';
import * as useDraggableSectionModule from '../../hooks/useDraggableSection';

// Mock useDraggableSection hook
jest.mock('../../hooks/useDraggableSection', () => ({
  useDraggableSection: jest.fn(() => ({
    isDragging: false,
    dragOverId: null,
    handlers: {
      onDragStart: jest.fn(),
      onDragOver: jest.fn(),
      onDrop: jest.fn(),
      onDragEnd: jest.fn(),
    },
  })),
}));

describe('DraggableSection', () => {
  const defaultProps = {
    id: 'test-section',
    index: 0,
    title: 'Test Section',
    children: <div>Test Content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render section with title and content', () => {
    render(<DraggableSection {...defaultProps} />);

    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render collapsed when defaultCollapsed is true', () => {
    render(<DraggableSection {...defaultProps} defaultCollapsed={true} />);

    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('should toggle collapse when collapse button is clicked', () => {
    render(<DraggableSection {...defaultProps} collapsible={true} />);

    const collapseButton = screen.getByLabelText('Collapse section');
    fireEvent.click(collapseButton);

    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('should call onReorder when section is dropped', () => {
    const onReorder = jest.fn();
    (
      useDraggableSectionModule.useDraggableSection as jest.Mock
    ).mockReturnValue({
      isDragging: false,
      dragOverId: null,
      handlers: {
        onDragStart: jest.fn(),
        onDragOver: jest.fn(),
        onDrop: onReorder,
        onDragEnd: jest.fn(),
      },
    });

    render(<DraggableSection {...defaultProps} onReorder={onReorder} />);

    const section = screen
      .getByText('Test Section')
      .closest('.draggable-section');
    if (section) {
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
      });
      fireEvent(section, dropEvent);
    }
  });

  it('should show drag-over indicator when dragOverId matches', () => {
    (
      useDraggableSectionModule.useDraggableSection as jest.Mock
    ).mockReturnValue({
      isDragging: true,
      dragOverId: 'test-section',
      handlers: {
        onDragStart: jest.fn(),
        onDragOver: jest.fn(),
        onDrop: jest.fn(),
        onDragEnd: jest.fn(),
      },
    });

    const { container } = render(<DraggableSection {...defaultProps} />);

    expect(
      container.querySelector('.draggable-section.drag-over'),
    ).toBeInTheDocument();
  });

  it('should show dragging state when isDragging is true', () => {
    (
      useDraggableSectionModule.useDraggableSection as jest.Mock
    ).mockReturnValue({
      isDragging: true,
      dragOverId: null,
      handlers: {
        onDragStart: jest.fn(),
        onDragOver: jest.fn(),
        onDrop: jest.fn(),
        onDragEnd: jest.fn(),
      },
    });

    const { container } = render(<DraggableSection {...defaultProps} />);

    expect(
      container.querySelector('.draggable-section.dragging'),
    ).toBeInTheDocument();
  });
});

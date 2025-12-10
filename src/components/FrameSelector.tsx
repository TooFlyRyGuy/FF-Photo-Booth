import '../styles/FrameSelector.css';

interface FrameSelectorProps {
  selectedFrame: string;
  onSelectFrame: (frame: string) => void;
  disabled?: boolean;
}

const frames = [
  { id: 'classic', name: 'Classic', icon: '🖼️' },
  { id: 'modern', name: 'Modern', icon: '⬛' },
  { id: 'vintage', name: 'Vintage', icon: '📜' },
  { id: 'neon', name: 'Neon', icon: '💡' },
  { id: 'rainbow', name: 'Rainbow', icon: '🌈' },
  { id: 'polaroid', name: 'Polaroid', icon: '📸' },
];

const FrameSelector = ({ selectedFrame, onSelectFrame, disabled }: FrameSelectorProps) => {
  return (
    <div className="frame-selector">
      <h3>Choose Your Frame</h3>
      <div className="frame-options">
        {frames.map((frame) => (
          <button
            key={frame.id}
            className={`frame-option ${selectedFrame === frame.id ? 'selected' : ''} ${
              disabled ? 'disabled' : ''
            }`}
            onClick={() => !disabled && onSelectFrame(frame.id)}
            disabled={disabled}
          >
            <span className="frame-icon">{frame.icon}</span>
            <span className="frame-name">{frame.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FrameSelector;

import { useState, useEffect } from 'react';
import { scryfallApi, type CommanderPrinting } from '../services/api';
import { IconX, IconAlertTriangle, IconPalette, IconCheck } from '@tabler/icons-react';

interface ArtSelectorModalProps {
  commanderName: string;
  currentImageUrl?: string;
  onSelect: (imageUrl: string) => void;
  onClose: () => void;
}

function ArtSelectorModal({
  commanderName,
  currentImageUrl,
  onSelect,
  onClose,
}: ArtSelectorModalProps) {
  const [printings, setPrintings] = useState<CommanderPrinting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  useEffect(() => {
    const fetchPrintings = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await scryfallApi.getCommanderPrintings(commanderName);
        setPrintings(results);

        // Find currently selected printing by matching image URL
        if (currentImageUrl) {
          const current = results.find(
            (p) =>
              p.image_art_crop === currentImageUrl ||
              p.image_normal === currentImageUrl
          );
          if (current?.illustration_id) {
            setSelectedId(current.illustration_id);
          }
        }
      } catch (err) {
        setError('Failed to load artwork versions');
        console.error('Error fetching printings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrintings();
  }, [commanderName, currentImageUrl]);

  const handleSelect = (printing: CommanderPrinting) => {
    const imageUrl = printing.image_art_crop || printing.image_normal || '';
    onSelect(imageUrl);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[2100] backdrop-blur-sm overflow-hidden"
      onClick={handleBackdropClick}
      style={{ animation: 'fadeIn 0.2s ease-out' }}
    >
      <div
        className="bg-[#1a1b1e] md:border border-[#2c2e33] md:rounded-[16px] w-full md:w-[95%] md:max-w-[900px] h-full md:h-auto md:max-h-[85vh] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="flex flex-col p-5 px-6 border-b border-[#2c2e33] relative flex-shrink-0">
          <h2 className="text-xl font-bold text-white m-0 mb-1">Choose Artwork</h2>
          <div className="text-sm text-[#667eea] font-medium">{commanderName}</div>
          <button
            className="absolute top-4 right-5 bg-transparent border-none text-[#9ca3af] cursor-pointer p-1 flex items-center justify-center transition-all hover:text-white hover:scale-110"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={24} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 px-6 custom-scrollbar">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="loading-spinner"></div>
              <div className="mt-4 text-sm text-[#9ca3af]">
                Loading artwork versions...
              </div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <IconAlertTriangle size={48} className="text-[#ef4444] mb-4" />
              <div className="text-sm text-[#ef4444]">{error}</div>
            </div>
          )}

          {!loading && !error && printings.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <IconPalette size={64} className="text-[#9ca3af] mb-4 opacity-50" />
              <div className="text-base text-[#9ca3af]">
                No alternate artwork found
              </div>
            </div>
          )}

          {!loading && !error && printings.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {printings.map((printing, index) => (
                <button
                  key={`${printing.illustration_id || printing.set_code}-${index}`}
                  className={`bg-[rgba(44,46,51,0.3)] border-2 rounded-[12px] p-0 cursor-pointer transition-all overflow-hidden text-left hover:border-[rgba(102,126,234,0.5)] hover:bg-[rgba(44,46,51,0.5)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] ${
                    selectedId === printing.illustration_id
                      ? 'border-[#667eea] shadow-[0_0_0_2px_rgba(102,126,234,0.3)]'
                      : 'border-[#2c2e33]'
                  }`}
                  onClick={() => handleSelect(printing)}
                >
                  <div className="relative aspect-[488/680] overflow-hidden bg-[#25262b]">
                    {printing.image_normal ? (
                      <img
                        src={printing.image_normal}
                        alt={`${printing.name} - ${printing.set_name}`}
                        className="w-full h-full object-cover transition-transform hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#6b7280] text-sm">
                        No Image
                      </div>
                    )}
                    {selectedId === printing.illustration_id && (
                      <div className="absolute top-2 right-2 w-7 h-7 bg-gradient-purple rounded-full flex items-center justify-center text-white shadow-[0_2px_8px_rgba(102,126,234,0.4)]">
                        <IconCheck size={18} stroke={3} />
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-[rgba(0,0,0,0.2)]">
                    <div className="text-[13px] font-semibold text-[#e5e7eb] mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                      {printing.set_name}
                    </div>
                    <div className="text-[11px] text-[#9ca3af] uppercase">
                      {printing.set_code.toUpperCase()} #{printing.collector_number}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="p-4 px-6 border-t border-[#2c2e33] flex justify-end flex-shrink-0">
          <button
            className="py-2.5 px-6 bg-[rgba(107,114,128,0.15)] border border-[rgba(107,114,128,0.3)] rounded-[8px] text-[#9ca3af] text-sm font-semibold cursor-pointer transition-all hover:bg-[rgba(107,114,128,0.25)] hover:border-[rgba(107,114,128,0.5)] hover:text-white"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a1b1e;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2c2e33;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3c3e43;
        }
      `}</style>
    </div>
  );
}

export default ArtSelectorModal;

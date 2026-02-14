import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePod } from '../contexts/PodContext';
import { podApi, eventApi } from '../services/api';
import type { PodMember, CreateEventRequest } from '../services/api';
import toast from 'react-hot-toast';
import {
  IconArrowLeft,
  IconUsers,
  IconTrophy,
  IconPhoto,
  IconHash,
  IconCheck,
  IconLoader2,
  IconUserCheck,
  IconX,
} from '@tabler/icons-react';

const VALID_PLAYER_COUNTS = [4, 8, 12];

function getNearestValidCount(count: number): number {
  let nearest = VALID_PLAYER_COUNTS[0];
  let minDiff = Math.abs(count - nearest);
  for (const valid of VALID_PLAYER_COUNTS) {
    const diff = Math.abs(count - valid);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = valid;
    }
  }
  return nearest;
}

function getTargetCount(selectedCount: number): number {
  // If already valid, return it
  if (VALID_PLAYER_COUNTS.includes(selectedCount)) return selectedCount;
  // Otherwise find nearest valid count that is >= selectedCount, or the largest valid count
  for (const valid of VALID_PLAYER_COUNTS) {
    if (valid >= selectedCount) return valid;
  }
  return VALID_PLAYER_COUNTS[VALID_PLAYER_COUNTS.length - 1];
}

function getAvatarUrl(member: PodMember): string {
  return member.custom_avatar || member.picture || member.avatar || '';
}

export function EventCreate() {
  const navigate = useNavigate();
  const { currentPlayer } = useAuth();
  const { currentPod } = usePod();

  const [eventName, setEventName] = useState('');
  const [roundCount, setRoundCount] = useState(3);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<PodMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load pod members
  useEffect(() => {
    if (!currentPod?.id) return;
    const loadMembers = async () => {
      try {
        setLoadingMembers(true);
        const data = await podApi.getMembers(currentPod.id!);
        setMembers(data);
      } catch (err) {
        console.error('Error loading pod members:', err);
        toast.error('Failed to load pod members');
      } finally {
        setLoadingMembers(false);
      }
    };
    loadMembers();
  }, [currentPod?.id]);

  // Image upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setCustomImage(base64String);
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setCustomImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Player selection
  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPlayerIds(new Set(members.map((m) => m.player_id)));
  };

  const deselectAll = () => {
    setSelectedPlayerIds(new Set());
  };

  // Validation
  const selectedCount = selectedPlayerIds.size;
  const isValidPlayerCount = VALID_PLAYER_COUNTS.includes(selectedCount);
  const targetCount = getTargetCount(selectedCount);
  const isNameValid = eventName.trim().length > 0;
  const isRoundCountValid = roundCount >= 1 && roundCount <= 10;
  const canSubmit = isNameValid && isValidPlayerCount && isRoundCountValid && !submitting;

  // Submit handler
  const handleSubmit = async () => {
    if (!canSubmit || !currentPod?.id) return;

    try {
      setSubmitting(true);
      const request: CreateEventRequest = {
        name: eventName.trim(),
        pod_id: currentPod.id!,
        player_ids: Array.from(selectedPlayerIds),
        round_count: roundCount,
        custom_image: customImage || undefined,
      };
      const event = await eventApi.create(request);
      toast.success('Event created!');
      navigate(`/event/${event.id}`);
    } catch (err: any) {
      console.error('Error creating event:', err);
      const message = err?.response?.data?.detail || 'Failed to create event';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentPod) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[#909296]">No pod selected. Please select a pod first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-[#25262B] border border-[#2C2E33] text-[#909296] hover:text-white hover:border-[#667eea] transition-colors"
        >
          <IconArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Create Event</h1>
          <p className="text-sm text-[#909296]">{currentPod.name}</p>
        </div>
      </div>

      {/* Event Name Section */}
      <div className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] p-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-[#909296] mb-2">
          <IconTrophy size={16} />
          Event Name
        </label>
        <input
          type="text"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="Friday Night Commander"
          className="w-full bg-[#25262B] text-white rounded-[8px] border border-[#2C2E33] px-3 py-2 focus:outline-none focus:border-[#667eea] transition-colors placeholder-[#5C5F66]"
          maxLength={100}
        />
      </div>

      {/* Event Logo Section */}
      <div className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] p-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-[#909296] mb-2">
          <IconPhoto size={16} />
          Event Logo
          <span className="text-xs text-[#5C5F66] ml-1">(optional)</span>
        </label>

        {customImage ? (
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-[10px] overflow-hidden border border-[#2C2E33] flex-shrink-0">
              <img src={customImage} alt="Event logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-[#667eea] hover:text-[#764ba2] transition-colors"
              >
                Change image
              </button>
              <button
                onClick={handleRemoveImage}
                className="text-sm text-[#FF6B6B] hover:text-[#FF4444] transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 border-2 border-dashed border-[#2C2E33] rounded-[10px] text-[#5C5F66] hover:border-[#667eea] hover:text-[#667eea] transition-colors flex items-center justify-center gap-2"
          >
            <IconPhoto size={18} />
            <span className="text-sm">Upload image</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Number of Rounds Section */}
      <div className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] p-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-[#909296] mb-2">
          <IconHash size={16} />
          Number of Rounds
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={roundCount}
            onChange={(e) => setRoundCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
            min={1}
            max={10}
            className="w-24 bg-[#25262B] text-white text-center rounded-[8px] border border-[#2C2E33] px-3 py-2 focus:outline-none focus:border-[#667eea] transition-colors"
          />
          <span className="text-sm text-[#5C5F66]">
            {roundCount === 1 ? '1 round' : `${roundCount} rounds`}
          </span>
        </div>
        {!isRoundCountValid && (
          <p className="text-xs text-[#FF6B6B] mt-2">Rounds must be between 1 and 10</p>
        )}
      </div>

      {/* Player Selection Section */}
      <div className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 text-sm text-[#909296]">
            <IconUsers size={16} />
            Select Players
          </label>
          <div className="flex items-center gap-2">
            {/* Count Badge */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                isValidPlayerCount
                  ? 'bg-[#2B8A3E]/20 text-[#51CF66] border border-[#2B8A3E]/40'
                  : 'bg-[#25262B] text-[#909296] border border-[#2C2E33]'
              }`}
            >
              {isValidPlayerCount && <IconCheck size={12} />}
              {selectedCount}/{targetCount}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={selectAll}
            className="text-xs px-3 py-1.5 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#909296] hover:text-white hover:border-[#667eea] transition-colors"
          >
            Select All
          </button>
          {selectedCount > 0 && (
            <button
              onClick={deselectAll}
              className="text-xs px-3 py-1.5 rounded-[6px] bg-[#25262B] border border-[#2C2E33] text-[#909296] hover:text-white hover:border-[#FF6B6B] transition-colors"
            >
              Clear
            </button>
          )}
          <div className="ml-auto text-xs text-[#5C5F66]">
            Must be 4, 8, or 12 players
          </div>
        </div>

        {/* Player Grid */}
        {loadingMembers ? (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 size={24} className="animate-spin text-[#667eea]" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-[#5C5F66]">
            <IconUsers size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No members in this pod yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {members.map((member) => {
              const isSelected = selectedPlayerIds.has(member.player_id);
              const avatarUrl = getAvatarUrl(member);
              return (
                <button
                  key={member.player_id}
                  onClick={() => togglePlayer(member.player_id)}
                  className={`relative flex items-center gap-2.5 p-2.5 rounded-[10px] border transition-all duration-150 text-left ${
                    isSelected
                      ? 'bg-[#667eea]/10 border-[#667eea]/50 ring-1 ring-[#667eea]/30'
                      : 'bg-[#25262B] border-[#2C2E33] hover:border-[#3C3E43]'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center ${
                        !avatarUrl ? 'bg-gradient-to-br from-[#667eea] to-[#764ba2]' : ''
                      }`}
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={member.player_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-white">
                          {member.player_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {/* Selection checkmark */}
                    {isSelected && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                      >
                        <IconCheck size={10} className="text-white" />
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <span
                    className={`text-sm truncate ${
                      isSelected ? 'text-white font-medium' : 'text-[#C1C2C5]'
                    }`}
                  >
                    {member.player_name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Validation message */}
        {selectedCount > 0 && !isValidPlayerCount && (
          <p className="text-xs text-[#FFA94D] mt-3 flex items-center gap-1.5">
            <IconUserCheck size={14} />
            Select {getNearestValidCount(selectedCount)} players (need exactly 4, 8, or 12)
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full py-3.5 rounded-[10px] font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 ${
          canSubmit
            ? 'hover:opacity-90 active:scale-[0.98]'
            : 'opacity-40 cursor-not-allowed'
        }`}
        style={{
          background: canSubmit
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            : '#25262B',
        }}
      >
        {submitting ? (
          <>
            <IconLoader2 size={18} className="animate-spin" />
            Creating Event...
          </>
        ) : (
          <>
            <IconTrophy size={18} />
            Create Event
          </>
        )}
      </button>
    </div>
  );
}

import type { Pod } from '../services/api';

interface PodsListProps {
  pods: Pod[];
  onEdit: (pod: Pod) => void;
  onDelete: (podId: string) => void;
  isLoading?: boolean;
}

function PodsList({ pods, onEdit, onDelete, isLoading = false }: PodsListProps) {
  if (isLoading) {
    return (
      <div className="text-center py-[60px] px-5">
        <div className="loading-spinner"></div>
        <p className="text-[#909296] text-sm">Loading pods...</p>
      </div>
    );
  }

  if (pods.length === 0) {
    return (
      <div className="text-center py-[60px] px-5">
        <div className="text-[64px] mb-4">🏠</div>
        <h3 className="text-white text-xl mb-2">No pods yet</h3>
        <p className="text-[#909296] text-sm">Create your first pod to get started!</p>
      </div>
    );
  }

  const handleDelete = (podId: string, podName: string) => {
    if (window.confirm(`Are you sure you want to delete "${podName}"? This cannot be undone.`)) {
      onDelete(podId);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#2C2E33]">
            <th className="text-left p-4 text-[#909296] text-xs font-semibold uppercase tracking-wider">Pod Name</th>
            <th className="text-left p-4 text-[#909296] text-xs font-semibold uppercase tracking-wider">Description</th>
            <th className="text-left p-4 text-[#909296] text-xs font-semibold uppercase tracking-wider">Members</th>
            <th className="text-left p-4 text-[#909296] text-xs font-semibold uppercase tracking-wider">Created</th>
            <th className="text-right p-4 text-[#909296] text-xs font-semibold uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {pods.map((pod) => (
            <tr key={pod.id} className="border-b border-[#2C2E33] transition-colors hover:bg-[rgba(102,126,234,0.05)]">
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <img src="/logo.png" alt={pod.name} className="w-10 h-10 object-contain" />
                  <span className="text-white font-medium">{pod.name}</span>
                </div>
              </td>
              <td className="p-4">
                <span className="text-[#909296] text-sm">
                  {pod.description || '-'}
                </span>
              </td>
              <td className="p-4">
                <span className="text-white">{pod.member_count || pod.member_ids?.length || 0}</span>
              </td>
              <td className="p-4">
                <span className="text-[#909296] text-sm">
                  {pod.created_at ? new Date(pod.created_at).toLocaleDateString() : '-'}
                </span>
              </td>
              <td className="p-4">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onEdit(pod)}
                    className="bg-transparent border border-[#667eea] text-[#667eea] py-2 px-4 rounded-[6px] text-xs font-semibold cursor-pointer transition-all hover:bg-[rgba(102,126,234,0.1)]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(pod.id!, pod.name)}
                    className="bg-transparent border border-[#FF6B6B] text-[#FF6B6B] py-2 px-4 rounded-[6px] text-xs font-semibold cursor-pointer transition-all hover:bg-[rgba(255,107,107,0.1)]"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PodsList;

from fastapi import APIRouter, HTTPException, status, Depends
from beanie import PydanticObjectId
from typing import List, Dict, Any
from datetime import datetime

from app.models.pod import Pod, PodInvite
from app.models.player import Player
from app.middleware.auth import get_current_player

router = APIRouter()


# ==================== POD CRUD ENDPOINTS ====================

@router.get("/")
async def get_user_pods(current_player: Player = Depends(get_current_player)):
    """Get all pods the current user belongs to"""
    player_id_str = str(current_player.id)

    # All users (including superusers) only see pods they're members of
    # Superusers can manage all pods via admin panel, but pod drawer shows only their pods
    pods = await Pod.find(Pod.member_ids == player_id_str).to_list()

    return [
        {
            "id": str(pod.id),
            "name": pod.name,
            "description": pod.description,
            "custom_image": pod.custom_image,
            "creator_id": pod.creator_id,
            "member_count": len(pod.member_ids),
            "is_admin": player_id_str in pod.admin_ids or current_player.is_superuser,
            "is_creator": pod.creator_id == player_id_str,
            "created_at": pod.created_at
        }
        for pod in pods
    ]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_pod(
    name: str,
    description: str = None,
    current_player: Player = Depends(get_current_player)
):
    """Create a new pod (requires authentication)"""
    creator_id = str(current_player.id)

    # Create pod with creator as first admin and member
    pod = Pod(
        name=name,
        description=description,
        creator_id=creator_id,
        admin_ids=[creator_id],
        member_ids=[creator_id]
    )
    await pod.insert()

    # Add pod to player's pod_ids and set as current
    await current_player.set({
        Player.pod_ids: current_player.pod_ids + [str(pod.id)],
        Player.current_pod_id: str(pod.id)
    })

    return {
        "id": str(pod.id),
        "name": pod.name,
        "description": pod.description,
        "custom_image": pod.custom_image,
        "creator_id": pod.creator_id,
        "admin_ids": pod.admin_ids,
        "member_ids": pod.member_ids,
        "created_at": pod.created_at
    }


@router.get("/{pod_id}")
async def get_pod(
    pod_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player)
):
    """Get pod details (members only)"""
    pod = await Pod.get(pod_id)
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    player_id_str = str(current_player.id)

    # Check membership (or superuser)
    if player_id_str not in pod.member_ids and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a pod member to view details"
        )

    return {
        "id": str(pod.id),
        "name": pod.name,
        "description": pod.description,
        "creator_id": pod.creator_id,
        "admin_ids": pod.admin_ids,
        "member_ids": pod.member_ids,
        "member_count": len(pod.member_ids),
        "created_at": pod.created_at
    }


@router.put("/{pod_id}")
async def update_pod(
    pod_id: PydanticObjectId,
    name: str = None,
    description: str = None,
    custom_image: str = None,
    current_player: Player = Depends(get_current_player)
):
    """Update pod details (admins only)"""
    pod = await Pod.get(pod_id)
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    player_id_str = str(current_player.id)

    # Check admin access
    if player_id_str not in pod.admin_ids and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pod admin access required"
        )

    # Update fields
    update_data = {}
    if name is not None:
        update_data[Pod.name] = name
    if description is not None:
        update_data[Pod.description] = description
    if custom_image is not None:
        # Empty string means remove image
        update_data[Pod.custom_image] = custom_image if custom_image != "" else None

    if update_data:
        await pod.set(update_data)

    return {
        "id": str(pod.id),
        "name": pod.name,
        "description": pod.description,
        "custom_image": pod.custom_image,
        "creator_id": pod.creator_id,
        "admin_ids": pod.admin_ids,
        "member_ids": pod.member_ids,
        "created_at": pod.created_at
    }


@router.delete("/{pod_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pod(
    pod_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player)
):
    """Delete a pod (creator only, requires empty pod)"""
    pod = await Pod.get(pod_id)
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    player_id_str = str(current_player.id)

    # Only creator or superuser can delete
    if pod.creator_id != player_id_str and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the pod creator can delete the pod"
        )

    # Check if pod has other members
    if len(pod.member_ids) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete pod with members. Remove all members first."
        )

    await pod.delete()


@router.post("/{pod_id}/leave")
async def leave_pod(
    pod_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player)
):
    """Leave a pod (cannot leave if last admin)"""
    pod = await Pod.get(pod_id)
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    player_id_str = str(current_player.id)

    # Check if player is a member
    if player_id_str not in pod.member_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not a member of this pod"
        )

    # Check if last admin
    if player_id_str in pod.admin_ids and len(pod.admin_ids) == 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot leave pod as the last admin. Promote another member to admin first or delete the pod."
        )

    # Remove from pod
    new_member_ids = [mid for mid in pod.member_ids if mid != player_id_str]
    new_admin_ids = [aid for aid in pod.admin_ids if aid != player_id_str]

    await pod.set({
        Pod.member_ids: new_member_ids,
        Pod.admin_ids: new_admin_ids
    })

    # Remove pod from player's pod_ids
    new_player_pod_ids = [pid for pid in current_player.pod_ids if pid != str(pod_id)]
    update_data = {Player.pod_ids: new_player_pod_ids}

    # If this was current pod, switch to first available pod
    if current_player.current_pod_id == str(pod_id):
        update_data[Player.current_pod_id] = new_player_pod_ids[0] if new_player_pod_ids else None

    await current_player.set(update_data)

    return {"message": "Successfully left pod"}


# ==================== POD MEMBERS ====================

@router.get("/{pod_id}/members")
async def get_pod_members(
    pod_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player)
):
    """Get list of pod members with details"""
    pod = await Pod.get(pod_id)
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    player_id_str = str(current_player.id)

    # Check membership or superuser
    if player_id_str not in pod.member_ids and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a pod member to view members"
        )

    # Fetch all member details
    members = []
    for member_id in pod.member_ids:
        try:
            player = await Player.get(PydanticObjectId(member_id))
            if player:
                members.append({
                    "player_id": member_id,
                    "player_name": player.name,
                    "avatar": player.avatar,
                    "picture": player.picture,
                    "custom_avatar": player.custom_avatar,
                    "is_creator": member_id == pod.creator_id,
                    "is_admin": member_id in pod.admin_ids,
                    "is_superuser": player.is_superuser
                })
        except Exception:
            continue

    return members


@router.delete("/{pod_id}/members/{player_id}")
async def remove_member(
    pod_id: PydanticObjectId,
    player_id: str,
    current_player: Player = Depends(get_current_player)
):
    """Remove a member from the pod (admins only)"""
    pod = await Pod.get(pod_id)
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    current_player_id_str = str(current_player.id)

    # Check admin access
    if current_player_id_str not in pod.admin_ids and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pod admin access required"
        )

    # Cannot remove yourself
    if player_id == current_player_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself. Use the leave endpoint instead."
        )

    # Check if target is a member
    if player_id not in pod.member_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player is not a member of this pod"
        )

    # Cannot remove last admin
    if player_id in pod.admin_ids and len(pod.admin_ids) == 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the last admin"
        )

    # Remove from pod
    new_member_ids = [mid for mid in pod.member_ids if mid != player_id]
    new_admin_ids = [aid for aid in pod.admin_ids if aid != player_id]

    await pod.set({
        Pod.member_ids: new_member_ids,
        Pod.admin_ids: new_admin_ids
    })

    # Remove pod from player's pod_ids
    try:
        target_player = await Player.get(PydanticObjectId(player_id))
        if target_player:
            new_player_pod_ids = [pid for pid in target_player.pod_ids if pid != str(pod_id)]
            update_data = {Player.pod_ids: new_player_pod_ids}

            # If this was their current pod, switch to first available
            if target_player.current_pod_id == str(pod_id):
                update_data[Player.current_pod_id] = new_player_pod_ids[0] if new_player_pod_ids else None

            await target_player.set(update_data)
    except Exception:
        pass  # Player might not exist anymore

    return {"message": "Member removed successfully"}


@router.post("/{pod_id}/members/{player_id}/promote")
async def promote_to_admin(
    pod_id: PydanticObjectId,
    player_id: str,
    current_player: Player = Depends(get_current_player)
):
    """Promote a member to admin (admins only)"""
    pod = await Pod.get(pod_id)
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    current_player_id_str = str(current_player.id)

    # Check admin access
    if current_player_id_str not in pod.admin_ids and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pod admin access required"
        )

    # Check if target is a member
    if player_id not in pod.member_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player is not a member of this pod"
        )

    # Check if already an admin
    if player_id in pod.admin_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player is already an admin"
        )

    # Add to admin_ids
    new_admin_ids = pod.admin_ids + [player_id]
    await pod.set({Pod.admin_ids: new_admin_ids})

    return {"message": "Member promoted to admin successfully"}


@router.post("/{pod_id}/members/{player_id}/demote")
async def demote_from_admin(
    pod_id: PydanticObjectId,
    player_id: str,
    current_player: Player = Depends(get_current_player)
):
    """Demote an admin to regular member (admins only, cannot demote creator or last admin)"""
    pod = await Pod.get(pod_id)
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    current_player_id_str = str(current_player.id)

    # Check admin access
    if current_player_id_str not in pod.admin_ids and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pod admin access required"
        )

    # Check if target is a member
    if player_id not in pod.member_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player is not a member of this pod"
        )

    # Check if they are an admin
    if player_id not in pod.admin_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player is not an admin"
        )

    # Cannot demote the creator
    if player_id == pod.creator_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote the pod creator"
        )

    # Cannot demote if they are the last admin
    if len(pod.admin_ids) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote the last admin"
        )

    # Remove from admin_ids
    new_admin_ids = [aid for aid in pod.admin_ids if aid != player_id]
    await pod.set({Pod.admin_ids: new_admin_ids})

    return {"message": "Admin demoted to member successfully"}


# ==================== POD INVITATIONS ====================

@router.post("/{pod_id}/invite", status_code=status.HTTP_201_CREATED)
async def invite_to_pod(
    pod_id: PydanticObjectId,
    invitee_email: str,
    current_player: Player = Depends(get_current_player)
):
    """Send invitation to join pod by email (admins only)"""
    pod = await Pod.get(pod_id)
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    inviter_id = str(current_player.id)

    # Check admin access
    if inviter_id not in pod.admin_ids and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pod admin access required to send invites"
        )

    # Find player by email
    invitee_player = await Player.find_one(Player.email == invitee_email)

    # Check if player is already a member
    if invitee_player and str(invitee_player.id) in pod.member_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player is already a member of this pod"
        )

    # Check for existing pending invite
    existing_invite = await PodInvite.find_one(
        PodInvite.pod_id == str(pod_id),
        PodInvite.invitee_email == invitee_email,
        PodInvite.status == "pending"
    )

    if existing_invite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pending invite already exists for this email"
        )

    # Create invite
    invite = PodInvite(
        pod_id=str(pod_id),
        inviter_id=inviter_id,
        invitee_email=invitee_email,
        invitee_player_id=str(invitee_player.id) if invitee_player else None,
        status="pending"
    )
    await invite.insert()

    return {
        "id": str(invite.id),
        "pod_id": invite.pod_id,
        "inviter_id": invite.inviter_id,
        "invitee_email": invite.invitee_email,
        "status": invite.status,
        "created_at": invite.created_at
    }


@router.get("/invites/")
async def get_pending_invites(current_player: Player = Depends(get_current_player)):
    """Get pending pod invites for current user"""
    player_email = current_player.email
    player_id_str = str(current_player.id)

    if not player_email:
        return []  # Guest users or users without email have no invites

    # Find invites by email or player_id
    invites = await PodInvite.find(
        {
            "$and": [
                {"status": "pending"},
                {
                    "$or": [
                        {"invitee_email": player_email},
                        {"invitee_player_id": player_id_str}
                    ]
                }
            ]
        }
    ).to_list()

    # Enrich with pod and inviter details
    result = []
    for invite in invites:
        try:
            pod = await Pod.get(PydanticObjectId(invite.pod_id))
            inviter = await Player.get(PydanticObjectId(invite.inviter_id))

            if pod and inviter:
                result.append({
                    "id": str(invite.id),
                    "pod_id": invite.pod_id,
                    "pod_name": pod.name,
                    "pod_description": pod.description,
                    "inviter_id": invite.inviter_id,
                    "inviter_name": inviter.name,
                    "created_at": invite.created_at
                })
        except Exception:
            continue

    return result


@router.post("/invites/{invite_id}/accept")
async def accept_invite(
    invite_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player)
):
    """Accept a pod invitation"""
    invite = await PodInvite.get(invite_id)
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    # Check if invite is for current user
    player_email = current_player.email
    player_id_str = str(current_player.id)

    if invite.invitee_email != player_email and invite.invitee_player_id != player_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invite is not for you"
        )

    # Check if still pending
    if invite.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invite has already been {invite.status}"
        )

    # Get pod
    pod = await Pod.get(PydanticObjectId(invite.pod_id))
    if not pod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pod not found")

    # Add player to pod
    if player_id_str not in pod.member_ids:
        await pod.set({
            Pod.member_ids: pod.member_ids + [player_id_str]
        })

    # Add pod to player
    if invite.pod_id not in current_player.pod_ids:
        await current_player.set({
            Player.pod_ids: current_player.pod_ids + [invite.pod_id]
        })

    # Update invite status
    await invite.set({
        PodInvite.status: "accepted",
        PodInvite.responded_at: datetime.utcnow(),
        PodInvite.invitee_player_id: player_id_str  # Update player_id if it wasn't set
    })

    return {
        "message": "Invite accepted successfully",
        "pod_id": invite.pod_id,
        "pod_name": pod.name
    }


@router.post("/invites/{invite_id}/decline")
async def decline_invite(
    invite_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player)
):
    """Decline a pod invitation"""
    invite = await PodInvite.get(invite_id)
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    # Check if invite is for current user
    player_email = current_player.email
    player_id_str = str(current_player.id)

    if invite.invitee_email != player_email and invite.invitee_player_id != player_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invite is not for you"
        )

    # Check if still pending
    if invite.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invite has already been {invite.status}"
        )

    # Update invite status
    await invite.set({
        PodInvite.status: "declined",
        PodInvite.responded_at: datetime.utcnow()
    })

    return {"message": "Invite declined"}

"use client";

import { useState, useEffect } from "react";
import { TELEGRAM_COLORS } from "@/lib/telegram-theme";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  type: "public" | "private";
  isDefault: boolean;
  _count: { messages: number; members: number };
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  onCreateChannel: (data: { name: string; description: string; icon: string; type: string }) => Promise<void>;
  onDeleteChannel: (channelId: string) => Promise<void>;
  onEditChannel: (channelId: string, data: { name: string; description: string; icon: string }) => Promise<void>;
}

const CHANNEL_ICONS = ["💬", "📢", "🎯", "💡", "🔧", "📈", "🎨", "🌟", "🔥", "🚀", "💎", "🏆", "📊", "❓", "🎮", "🎵"];

export function AdminPanel({
  isOpen,
  onClose,
  channels,
  onCreateChannel,
  onDeleteChannel,
  onEditChannel,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"channels" | "users" | "settings">("channels");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("💬");
  const [type, setType] = useState<"public" | "private">("public");

  // Reset form
  const resetForm = () => {
    setName("");
    setDescription("");
    setIcon("💬");
    setType("public");
    setEditingChannel(null);
  };

  // Handle create/edit
  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      if (editingChannel) {
        await onEditChannel(editingChannel.id, { name, description, icon });
      } else {
        await onCreateChannel({ name, description, icon, type });
      }
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving channel:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (channelId: string) => {
    if (!confirm("Are you sure you want to delete this channel? All messages will be lost.")) {
      return;
    }

    setIsLoading(true);
    try {
      await onDeleteChannel(channelId);
    } catch (error) {
      console.error("Error deleting channel:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (channel: Channel) => {
    setEditingChannel(channel);
    setName(channel.name);
    setDescription(channel.description || "");
    setIcon(channel.icon || "💬");
    setType(channel.type);
    setShowCreateModal(true);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed inset-y-0 left-0 w-96 z-50 flex flex-col"
        style={{ backgroundColor: TELEGRAM_COLORS.bgColor }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{
            backgroundColor: TELEGRAM_COLORS.headerBg,
            borderColor: TELEGRAM_COLORS.border,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: "rgba(236, 57, 66, 0.2)",
                color: TELEGRAM_COLORS.destructive,
              }}
            >
              ADMIN
            </span>
            <h2 className="text-lg font-semibold" style={{ color: TELEGRAM_COLORS.text }}>
              Admin Panel
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full transition-colors"
            style={{ color: TELEGRAM_COLORS.hint }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex border-b"
          style={{ borderColor: TELEGRAM_COLORS.border }}
        >
          {(["channels", "users", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-3 text-sm font-medium capitalize transition-colors"
              style={{
                color: activeTab === tab ? TELEGRAM_COLORS.primary : TELEGRAM_COLORS.hint,
                borderBottom: activeTab === tab ? `2px solid ${TELEGRAM_COLORS.primary}` : "none",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "channels" && (
            <div className="p-4">
              {/* Create button */}
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="w-full py-3 rounded-lg font-medium transition-colors mb-4"
                style={{
                  backgroundColor: TELEGRAM_COLORS.primary,
                  color: TELEGRAM_COLORS.buttonText,
                }}
              >
                + Create Channel
              </button>

              {/* Channel list */}
              <div className="space-y-2">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ backgroundColor: TELEGRAM_COLORS.secondaryBg }}
                  >
                    <span className="text-2xl">{channel.icon || "💬"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate" style={{ color: TELEGRAM_COLORS.text }}>
                          {channel.name}
                        </p>
                        {channel.isDefault && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `${TELEGRAM_COLORS.primary}30`,
                              color: TELEGRAM_COLORS.primary,
                            }}
                          >
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: TELEGRAM_COLORS.hint }}>
                        {channel._count.members} members · {channel._count.messages} messages
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(channel)}
                        className="p-1.5 rounded transition-colors"
                        style={{ color: TELEGRAM_COLORS.hint }}
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {!channel.isDefault && (
                        <button
                          onClick={() => handleDelete(channel.id)}
                          className="p-1.5 rounded transition-colors"
                          style={{ color: TELEGRAM_COLORS.destructive }}
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="p-4 text-center" style={{ color: TELEGRAM_COLORS.hint }}>
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p>User management coming soon</p>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="p-4 text-center" style={{ color: TELEGRAM_COLORS.hint }}>
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p>Settings coming soon</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Channel Modal */}
      {showCreateModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => {
              setShowCreateModal(false);
              resetForm();
            }}
          />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg shadow-xl z-50"
            style={{ backgroundColor: TELEGRAM_COLORS.bgColor }}
          >
            <div
              className="p-4 border-b"
              style={{ borderColor: TELEGRAM_COLORS.border }}
            >
              <h3 className="font-semibold" style={{ color: TELEGRAM_COLORS.text }}>
                {editingChannel ? "Edit Channel" : "Create Channel"}
              </h3>
            </div>

            <div className="p-4 space-y-4">
              {/* Icon selector */}
              <div>
                <label className="block text-sm mb-2" style={{ color: TELEGRAM_COLORS.hint }}>
                  Icon
                </label>
                <div className="flex gap-2 flex-wrap">
                  {CHANNEL_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setIcon(emoji)}
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-colors"
                      style={{
                        backgroundColor: icon === emoji ? `${TELEGRAM_COLORS.primary}30` : TELEGRAM_COLORS.secondaryBg,
                        border: icon === emoji ? `2px solid ${TELEGRAM_COLORS.primary}` : "none",
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm mb-2" style={{ color: TELEGRAM_COLORS.hint }}>
                  Channel Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., general"
                  className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                  style={{
                    backgroundColor: TELEGRAM_COLORS.inputBg,
                    border: `1px solid ${TELEGRAM_COLORS.inputBorder}`,
                    color: TELEGRAM_COLORS.text,
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm mb-2" style={{ color: TELEGRAM_COLORS.hint }}>
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this channel about?"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none resize-none"
                  style={{
                    backgroundColor: TELEGRAM_COLORS.inputBg,
                    border: `1px solid ${TELEGRAM_COLORS.inputBorder}`,
                    color: TELEGRAM_COLORS.text,
                  }}
                />
              </div>

              {/* Type (only for new channels) */}
              {!editingChannel && (
                <div>
                  <label className="block text-sm mb-2" style={{ color: TELEGRAM_COLORS.hint }}>
                    Channel Type
                  </label>
                  <div className="flex gap-2">
                    {(["public", "private"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className="flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors"
                        style={{
                          backgroundColor: type === t ? `${TELEGRAM_COLORS.primary}30` : TELEGRAM_COLORS.secondaryBg,
                          color: type === t ? TELEGRAM_COLORS.primary : TELEGRAM_COLORS.hint,
                          border: type === t ? `1px solid ${TELEGRAM_COLORS.primary}` : `1px solid ${TELEGRAM_COLORS.border}`,
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div
              className="p-4 flex justify-end gap-2 border-t"
              style={{ borderColor: TELEGRAM_COLORS.border }}
            >
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-sm transition-colors"
                style={{ color: TELEGRAM_COLORS.hint }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || isLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: TELEGRAM_COLORS.primary,
                  color: TELEGRAM_COLORS.buttonText,
                }}
              >
                {isLoading ? "Saving..." : editingChannel ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

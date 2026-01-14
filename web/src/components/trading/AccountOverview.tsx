"use client";

interface AccountInfo {
  accountValue: number;
  totalMarginUsed: number;
  totalRawUsd: number;
  withdrawable: number;
}

interface AccountOverviewProps {
  account: AccountInfo | null;
  isLoading: boolean;
}

export function AccountOverview({ account, isLoading }: AccountOverviewProps) {
  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-800 rounded w-24"></div>
          <div className="h-8 bg-gray-800 rounded w-32"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-12 bg-gray-800 rounded"></div>
            <div className="h-12 bg-gray-800 rounded"></div>
            <div className="h-12 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <p className="text-gray-500 text-sm">
          Select a wallet and enter password to view account
        </p>
      </div>
    );
  }

  const freeMargin = account.accountValue - account.totalMarginUsed;
  const marginUsagePercent = account.accountValue > 0
    ? (account.totalMarginUsed / account.accountValue) * 100
    : 0;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <h3 className="font-semibold text-gray-200 mb-3">Account</h3>

      {/* Total Value */}
      <div className="mb-4">
        <div className="text-xs text-gray-500">Account Value</div>
        <div className="text-2xl font-bold font-mono">
          ${account.accountValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      </div>

      {/* Margin Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Margin Used</span>
          <span>{marginUsagePercent.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              marginUsagePercent > 80
                ? "bg-red-500"
                : marginUsagePercent > 50
                ? "bg-yellow-500"
                : "bg-green-500"
            }`}
            style={{ width: `${Math.min(marginUsagePercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500">Balance</div>
          <div className="font-mono text-sm">
            ${account.accountValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500">Margin</div>
          <div className="font-mono text-sm">
            ${account.totalMarginUsed.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500">Withdrawable</div>
          <div className="font-mono text-sm">
            ${account.withdrawable.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

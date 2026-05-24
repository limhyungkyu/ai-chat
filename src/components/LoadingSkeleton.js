"use client";

export function SidebarSkeleton() {
  return (
    <div className="space-y-4 p-2">
      <div className="h-10 w-full rounded-xl bg-primary/5 shimmer"></div>
      <div className="space-y-2 pt-2">
        <div className="h-3 w-16 bg-primary/5 rounded shimmer"></div>
        <div className="h-12 w-full rounded-lg bg-primary/5 shimmer"></div>
        <div className="h-12 w-full rounded-lg bg-primary/5 shimmer"></div>
      </div>
      <div className="space-y-2 mt-6">
        <div className="h-3 w-12 bg-primary/5 rounded shimmer"></div>
        <div className="h-10 w-full rounded-lg bg-primary/5 shimmer"></div>
        <div className="h-10 w-full rounded-lg bg-primary/5 shimmer"></div>
        <div className="h-10 w-full rounded-lg bg-primary/5 shimmer"></div>
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-6">
      {/* AI message skeleton */}
      <div className="flex space-x-3 w-[70%]">
        <div className="w-8 h-8 rounded-full bg-primary/10 shimmer flex-shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-[40%] bg-primary/5 rounded shimmer"></div>
          <div className="h-16 w-full rounded-2xl rounded-tl-sm bg-primary/5 shimmer"></div>
        </div>
      </div>
      
      {/* User message skeleton */}
      <div className="flex justify-end w-full">
        <div className="w-[50%] space-y-2">
          <div className="h-12 w-full rounded-2xl rounded-tr-sm bg-primary/10 shimmer"></div>
        </div>
      </div>

      {/* AI message skeleton */}
      <div className="flex space-x-3 w-[60%]">
        <div className="w-8 h-8 rounded-full bg-primary/10 shimmer flex-shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-[25%] bg-primary/5 rounded shimmer"></div>
          <div className="h-20 w-full rounded-2xl rounded-tl-sm bg-primary/5 shimmer"></div>
        </div>
      </div>
    </div>
  );
}


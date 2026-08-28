# Training participants fix v0.26.10

Fixed a regression in the Training program detail: the Participants tab rendered a translated/non-matching component identifier and stale old-tab branches remained in JSX. The tab now renders the actual `Participants` component and receives `program` plus `onRegenerate`, so participant list, Add, attendance correction, and both QR utilities are wired again. Added regression smoke assertions.

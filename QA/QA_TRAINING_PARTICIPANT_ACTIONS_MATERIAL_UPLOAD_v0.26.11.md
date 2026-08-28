# v0.26.11
- Participant toolbar reorganized: QR utilities grouped, primary Add action isolated at the far right.
- Material dialog now supports file selection/upload UI plus URL/reference alternative.
- Demo/local state stores file metadata only (name, size, MIME/type); it does not falsely claim durable binary storage. Supabase Storage wiring remains a backend phase.
- Material registry shows uploaded file name or URL.

#!/bin/bash
# 💾 Backup SQLite database hàng ngày (giữ 30 bản gần nhất)
#
# Cài cron (chạy 3h sáng mỗi ngày):
#   crontab -e
#   thêm dòng: 0 3 * * * /root/dsd/scripts/backup-db.sh >> /var/log/dsd-backup.log 2>&1
#
# Khôi phục từ backup:
#   pm2 stop dsd
#   cp /root/dsd-backups/dev-YYYY-MM-DD.db /root/dsd/dev.db
#   pm2 start dsd

DB="/root/dsd/dev.db"
BACKUP_DIR="/root/dsd-backups"
KEEP=30

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%F)
OUT="$BACKUP_DIR/dev-$STAMP.db"

# .backup an toàn với WAL mode (không cần dừng app)
sqlite3 "$DB" ".backup '$OUT'"

if [ $? -eq 0 ]; then
  echo "$(date -Iseconds) ✅ Backup OK: $OUT ($(du -h "$OUT" | cut -f1))"
else
  echo "$(date -Iseconds) ❌ Backup FAILED"
  exit 1
fi

# Xoá backup cũ, giữ $KEEP bản gần nhất
ls -1t "$BACKUP_DIR"/dev-*.db 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f

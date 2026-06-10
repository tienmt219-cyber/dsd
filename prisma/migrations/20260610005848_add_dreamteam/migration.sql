-- CreateTable
CREATE TABLE "DtOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rowIndex" INTEGER NOT NULL,
    "tenKhach" TEXT NOT NULL,
    "tenSp" TEXT NOT NULL,
    "maSP" TEXT NOT NULL,
    "size" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "soLuong" INTEGER NOT NULL DEFAULT 1,
    "giaSp" REAL NOT NULL,
    "linkFb" TEXT NOT NULL DEFAULT '',
    "trangThai" TEXT NOT NULL DEFAULT 'CHƯA ĐẶT',
    "ngayOd" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DtCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "maSP" TEXT NOT NULL,
    "tenSP" TEXT NOT NULL,
    "giaBan" REAL NOT NULL,
    "giaMua" REAL,
    "link" TEXT,
    "image" TEXT
);

-- CreateTable
CREATE TABLE "DtAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fb" TEXT NOT NULL,
    "postal" TEXT NOT NULL DEFAULT '',
    "pref" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "street" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "DtStock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "size" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "soLuong" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "DtEmsBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emsCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "items" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "DtSurplus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "sz" TEXT NOT NULL DEFAULT '',
    "cl" TEXT NOT NULL DEFAULT '',
    "sl" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "DtOrder_rowIndex_key" ON "DtOrder"("rowIndex");

-- CreateIndex
CREATE UNIQUE INDEX "DtCatalog_maSP_key" ON "DtCatalog"("maSP");

-- CreateIndex
CREATE UNIQUE INDEX "DtAddress_name_fb_key" ON "DtAddress"("name", "fb");

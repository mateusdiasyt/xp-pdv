-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('WITHDRAWAL', 'SUPPLY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('APPROVED', 'CANCELLED', 'REFUNDED', 'DIVERGENT');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('STANDARD', 'GAMEPLAY', 'SERVICE');

-- CreateEnum
CREATE TYPE "StockUnit" AS ENUM ('UNIT', 'MILLILITER');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GameplayReleaseStatus" AS ENUM ('LIBERADA', 'PAUSADA', 'CANCELADA', 'PENDENTE_ENVIO', 'FALHA_ENVIO');

-- CreateEnum
CREATE TYPE "ServiceDeclarationStatus" AS ENUM ('DECLARED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomerDocumentType" AS ENUM ('CPF', 'RG');

-- CreateEnum
CREATE TYPE "ComandaStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AccountPayableStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "PlatformTenantStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'FAILED');

-- CreateTable
CREATE TABLE "BusinessUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "roleId" TEXT NOT NULL,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("userId","permissionId")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "fiscalCfop" TEXT,
    "fiscalCsosn" TEXT,
    "fiscalIcmsOrigin" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "legalName" TEXT,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "ncm" TEXT,
    "fiscalCfop" TEXT,
    "fiscalCsosn" TEXT,
    "fiscalIcmsOrigin" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "kind" "ProductKind" NOT NULL DEFAULT 'STANDARD',
    "gameplayPlanCode" TEXT,
    "gameplayDurationMinutes" INTEGER,
    "serviceCnae" TEXT,
    "serviceDescription" TEXT,
    "costPrice" DECIMAL(12,4) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "happyHourPrice" DECIMAL(12,2),
    "marginPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "stockUnit" "StockUnit" NOT NULL DEFAULT 'UNIT',
    "tracksStock" BOOLEAN NOT NULL DEFAULT true,
    "pdvVisible" BOOLEAN NOT NULL DEFAULT true,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "categoryId" TEXT NOT NULL,
    "supplierId" TEXT,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRecipeIngredient" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "CouponDiscountType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "maxDiscountAmount" DECIMAL(12,2),
    "minSubtotalAmount" DECIMAL(12,2),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponCategory" (
    "couponId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "CouponCategory_pkey" PRIMARY KEY ("couponId","categoryId")
);

-- CreateTable
CREATE TABLE "CouponProduct" (
    "couponId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "CouponProduct_pkey" PRIMARY KEY ("couponId","productId")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,4),
    "previousStock" INTEGER NOT NULL,
    "resultingStock" INTEGER NOT NULL,
    "note" TEXT,
    "operatorId" TEXT,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockInvoiceXml" (
    "id" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceSeries" TEXT,
    "supplierName" TEXT,
    "supplierDocument" TEXT,
    "issuedAt" TIMESTAMP(3),
    "totalAmount" DECIMAL(12,2),
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "rawXml" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceFileSize" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockInvoiceXml_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashRegister" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingAmount" DECIMAL(12,2) NOT NULL,
    "expectedAmount" DECIMAL(12,2),
    "closingAmount" DECIMAL(12,2),
    "differenceAmount" DECIMAL(12,2),
    "note" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "cashSessionId" TEXT NOT NULL,
    "operatorId" TEXT,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "saleNumber" TEXT NOT NULL,
    "cashSessionId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "customerName" TEXT,
    "subtotalAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "fiscalReference" TEXT,
    "fiscalDocumentType" TEXT,
    "fiscalEnvironment" TEXT,
    "fiscalStatus" TEXT,
    "fiscalMessage" TEXT,
    "fiscalAccessKey" TEXT,
    "fiscalProtocol" TEXT,
    "fiscalNumber" TEXT,
    "fiscalSeries" TEXT,
    "fiscalXmlUrl" TEXT,
    "fiscalDanfeUrl" TEXT,
    "fiscalQrCodeUrl" TEXT,
    "fiscalConsultaUrl" TEXT,
    "fiscalIssuedAt" TIMESTAMP(3),
    "fiscalUpdatedAt" TIMESTAMP(3),
    "fiscalErrorAt" TIMESTAMP(3),
    "fiscalResponse" JSONB,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleCoupon" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "codeSnapshot" TEXT NOT NULL,
    "discountTypeSnapshot" "CouponDiscountType" NOT NULL,
    "discountValueSnapshot" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "birthDate" DATE,
    "documentType" "CustomerDocumentType" NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comanda" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "ComandaStatus" NOT NULL DEFAULT 'OPEN',
    "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,
    "customerNameSnapshot" TEXT,
    "subtotalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "closedSaleId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComandaItem" (
    "id" TEXT NOT NULL,
    "comandaId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComandaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "ncmSnapshot" TEXT,
    "fiscalCfopSnapshot" TEXT,
    "fiscalCsosnSnapshot" TEXT,
    "fiscalIcmsOriginSnapshot" TEXT,
    "productKindSnapshot" "ProductKind" NOT NULL DEFAULT 'STANDARD',
    "serviceCnaeSnapshot" TEXT,
    "serviceDescriptionSnapshot" TEXT,
    "serviceDeclarationId" TEXT,
    "serviceDeclaredAt" TIMESTAMP(3),
    "gameplayStationId" TEXT,
    "gameplayPlanCode" TEXT,
    "gameplayDurationMinutes" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "lineCostTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceFiscalDeclaration" (
    "id" TEXT NOT NULL,
    "serviceCnae" TEXT NOT NULL,
    "serviceDescription" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "nfseNumber" TEXT,
    "nfseIssuedAt" DATE,
    "notes" TEXT,
    "status" "ServiceDeclarationStatus" NOT NULL DEFAULT 'DECLARED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceFiscalDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameplayRelease" (
    "id" TEXT NOT NULL,
    "saleId" TEXT,
    "integrationId" TEXT NOT NULL DEFAULT 'pdv-xp-main',
    "stationId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "operator" TEXT NOT NULL,
    "customerId" TEXT,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "status" "GameplayReleaseStatus" NOT NULL DEFAULT 'PENDENTE_ENVIO',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "serviceStartsAt" TIMESTAMP(3),
    "preparationSeconds" INTEGER NOT NULL DEFAULT 30,
    "releasedUntil" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameplayRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'APPROVED',
    "approvedAmount" DECIMAL(12,2),
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "nsu" TEXT,
    "authorizationCode" TEXT,
    "terminalId" TEXT,
    "externalTransactionId" TEXT,
    "receiptText" TEXT,
    "auditNote" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleCancellation" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "refundStatus" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "refundMethod" "PaymentMethod",
    "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundNsu" TEXT,
    "refundAuthorizationCode" TEXT,
    "refundTerminalId" TEXT,
    "refundExternalTransactionId" TEXT,
    "refundReceiptText" TEXT,
    "fiscalStatus" TEXT,
    "fiscalMessage" TEXT,
    "stockRestored" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyGoal" (
    "id" TEXT NOT NULL,
    "goalDate" DATE NOT NULL,
    "entryTicketsTarget" INTEGER NOT NULL DEFAULT 0,
    "consumptionSalesTarget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "entryCategoryId" TEXT,
    "consumptionCategoryId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyGoalPlan" (
    "id" TEXT NOT NULL,
    "monthStart" DATE NOT NULL,
    "companyCost" DECIMAL(12,2) NOT NULL,
    "desiredProfitPercent" DECIMAL(5,2) NOT NULL,
    "monthlyRevenueTarget" DECIMAL(12,2) NOT NULL,
    "dailyRevenueTarget" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyGoalPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachmentImage" TEXT,
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountPayable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "isRecurringMonthly" BOOLEAN NOT NULL DEFAULT false,
    "dueDay" INTEGER,
    "status" "AccountPayableStatus" NOT NULL DEFAULT 'PENDING',
    "installmentNumber" INTEGER NOT NULL DEFAULT 1,
    "installmentTotal" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "receiptDataUrl" TEXT,
    "receiptFileName" TEXT,
    "receiptMimeType" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountPayable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformTenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "PlatformTenantStatus" NOT NULL DEFAULT 'PENDING',
    "planName" TEXT,
    "planStatus" TEXT NOT NULL DEFAULT 'pending',
    "planExpiresAt" TIMESTAMP(3),
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "ownerDocument" TEXT,
    "ownerWhatsapp" TEXT,
    "ownerPasswordHash" TEXT,
    "databaseName" TEXT,
    "databaseUrlEncrypted" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "companyNameConfirmedAt" TIMESTAMP(3),
    "customSlugUpdatedAt" TIMESTAMP(3),
    "lastProvisioningError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformTenantUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformTenantUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformGatewayConfiguration" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mercado-pago',
    "environment" TEXT NOT NULL DEFAULT 'test',
    "publicKey" TEXT,
    "accessTokenEncrypted" TEXT,
    "webhookSecretEncrypted" TEXT,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "lastTestStatus" TEXT,
    "lastTestMessage" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformGatewayConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "billingCycleMonths" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mercadoPagoPreapprovalId" TEXT,
    "mercadoPagoInitPoint" TEXT,
    "mercadoPagoExternalReference" TEXT NOT NULL,
    "payerEmail" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "nextPaymentAt" TIMESTAMP(3),
    "lastPaymentAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "rawSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mercado-pago',
    "eventType" TEXT NOT NULL,
    "resourceId" TEXT,
    "action" TEXT,
    "subscriptionId" TEXT,
    "tenantId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'received',
    "message" TEXT,
    "payload" JSONB,

    CONSTRAINT "PlatformPaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemUpdate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalConfiguration" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "environment" TEXT NOT NULL DEFAULT 'homologacao',
    "cnpjEmitente" TEXT,
    "defaultNcm" TEXT,
    "tokenHomologEncrypted" TEXT,
    "tokenProductionEncrypted" TEXT,
    "nfceHomologSeries" TEXT,
    "nfceHomologNextNumber" INTEGER,
    "nfceHomologIdToken" TEXT,
    "nfceHomologCscEncrypted" TEXT,
    "nfceProductionSeries" TEXT,
    "nfceProductionNextNumber" INTEGER,
    "nfceProductionIdToken" TEXT,
    "nfceProductionCscEncrypted" TEXT,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdvConfiguration" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "happyHourActive" BOOLEAN NOT NULL DEFAULT false,
    "happyHourUpdatedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdvConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCustomization" (
    "id" TEXT NOT NULL,
    "browserTitle" TEXT NOT NULL DEFAULT 'Mendoza PDV',
    "primaryColor" TEXT NOT NULL DEFAULT '#d4a62a',
    "accentColor" TEXT NOT NULL DEFAULT '#b9882a',
    "backgroundColor" TEXT NOT NULL DEFAULT '#0a0a0a',
    "foregroundColor" TEXT NOT NULL DEFAULT '#f4efe4',
    "logoDataUrl" TEXT,
    "faviconDataUrl" TEXT,
    "businessTimezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "businessDayStartsAt" TEXT NOT NULL DEFAULT '19:00',
    "businessDayEndsAt" TEXT NOT NULL DEFAULT '01:00',
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandCustomization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUnit_code_key" ON "BusinessUnit"("code");

-- CreateIndex
CREATE INDEX "BusinessUnit_name_idx" ON "BusinessUnit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_unitId_idx" ON "User"("unitId");

-- CreateIndex
CREATE INDEX "ProductCategory_status_idx" ON "ProductCategory"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slug_unitId_key" ON "ProductCategory"("slug", "unitId");

-- CreateIndex
CREATE INDEX "Supplier_tradeName_idx" ON "Supplier"("tradeName");

-- CreateIndex
CREATE INDEX "Supplier_status_idx" ON "Supplier"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_kind_idx" ON "Product"("kind");

-- CreateIndex
CREATE INDEX "Product_tracksStock_idx" ON "Product"("tracksStock");

-- CreateIndex
CREATE INDEX "Product_serviceCnae_idx" ON "Product"("serviceCnae");

-- CreateIndex
CREATE INDEX "Product_unitId_idx" ON "Product"("unitId");

-- CreateIndex
CREATE INDEX "ProductRecipeIngredient_ingredientProductId_idx" ON "ProductRecipeIngredient"("ingredientProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecipeIngredient_productId_ingredientProductId_key" ON "ProductRecipeIngredient"("productId", "ingredientProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_status_idx" ON "Coupon"("status");

-- CreateIndex
CREATE INDEX "Coupon_startsAt_endsAt_idx" ON "Coupon"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "CouponCategory_categoryId_idx" ON "CouponCategory"("categoryId");

-- CreateIndex
CREATE INDEX "CouponProduct_productId_idx" ON "CouponProduct"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "StockMovement_unitId_idx" ON "StockMovement"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "StockInvoiceXml_accessKey_key" ON "StockInvoiceXml"("accessKey");

-- CreateIndex
CREATE INDEX "StockInvoiceXml_createdAt_idx" ON "StockInvoiceXml"("createdAt");

-- CreateIndex
CREATE INDEX "StockInvoiceXml_invoiceNumber_invoiceSeries_idx" ON "StockInvoiceXml"("invoiceNumber", "invoiceSeries");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashRegister_code_key" ON "CashRegister"("code");

-- CreateIndex
CREATE INDEX "CashRegister_status_idx" ON "CashRegister"("status");

-- CreateIndex
CREATE INDEX "CashRegister_unitId_idx" ON "CashRegister"("unitId");

-- CreateIndex
CREATE INDEX "CashSession_cashRegisterId_status_idx" ON "CashSession"("cashRegisterId", "status");

-- CreateIndex
CREATE INDEX "CashSession_openedAt_idx" ON "CashSession"("openedAt");

-- CreateIndex
CREATE INDEX "CashMovement_cashSessionId_createdAt_idx" ON "CashMovement"("cashSessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_saleNumber_key" ON "Sale"("saleNumber");

-- CreateIndex
CREATE INDEX "Sale_cashSessionId_createdAt_idx" ON "Sale"("cashSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_operatorId_idx" ON "Sale"("operatorId");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "Sale"("status");

-- CreateIndex
CREATE INDEX "Sale_fiscalReference_idx" ON "Sale"("fiscalReference");

-- CreateIndex
CREATE INDEX "Sale_fiscalStatus_idx" ON "Sale"("fiscalStatus");

-- CreateIndex
CREATE INDEX "SaleCoupon_saleId_idx" ON "SaleCoupon"("saleId");

-- CreateIndex
CREATE INDEX "SaleCoupon_couponId_idx" ON "SaleCoupon"("couponId");

-- CreateIndex
CREATE INDEX "Customer_fullName_idx" ON "Customer"("fullName");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_documentType_documentNumber_key" ON "Customer"("documentType", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Comanda_closedSaleId_key" ON "Comanda"("closedSaleId");

-- CreateIndex
CREATE INDEX "Comanda_number_status_idx" ON "Comanda"("number", "status");

-- CreateIndex
CREATE INDEX "Comanda_openedAt_idx" ON "Comanda"("openedAt");

-- CreateIndex
CREATE INDEX "ComandaItem_comandaId_idx" ON "ComandaItem"("comandaId");

-- CreateIndex
CREATE INDEX "ComandaItem_productId_idx" ON "ComandaItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ComandaItem_comandaId_productId_key" ON "ComandaItem"("comandaId", "productId");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "SaleItem_productKindSnapshot_idx" ON "SaleItem"("productKindSnapshot");

-- CreateIndex
CREATE INDEX "SaleItem_serviceCnaeSnapshot_idx" ON "SaleItem"("serviceCnaeSnapshot");

-- CreateIndex
CREATE INDEX "SaleItem_serviceDeclarationId_idx" ON "SaleItem"("serviceDeclarationId");

-- CreateIndex
CREATE INDEX "ServiceFiscalDeclaration_serviceCnae_periodStart_periodEnd_idx" ON "ServiceFiscalDeclaration"("serviceCnae", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "ServiceFiscalDeclaration_status_idx" ON "ServiceFiscalDeclaration"("status");

-- CreateIndex
CREATE INDEX "ServiceFiscalDeclaration_createdById_idx" ON "ServiceFiscalDeclaration"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "GameplayRelease_saleId_key" ON "GameplayRelease"("saleId");

-- CreateIndex
CREATE INDEX "GameplayRelease_status_updatedAt_idx" ON "GameplayRelease"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "GameplayRelease_stationId_idx" ON "GameplayRelease"("stationId");

-- CreateIndex
CREATE INDEX "GameplayRelease_stationId_releasedUntil_idx" ON "GameplayRelease"("stationId", "releasedUntil");

-- CreateIndex
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_nsu_idx" ON "Payment"("nsu");

-- CreateIndex
CREATE INDEX "Payment_authorizationCode_idx" ON "Payment"("authorizationCode");

-- CreateIndex
CREATE INDEX "Payment_externalTransactionId_idx" ON "Payment"("externalTransactionId");

-- CreateIndex
CREATE INDEX "Payment_terminalId_createdAt_idx" ON "Payment"("terminalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaleCancellation_saleId_key" ON "SaleCancellation"("saleId");

-- CreateIndex
CREATE INDEX "SaleCancellation_refundStatus_idx" ON "SaleCancellation"("refundStatus");

-- CreateIndex
CREATE INDEX "SaleCancellation_refundMethod_idx" ON "SaleCancellation"("refundMethod");

-- CreateIndex
CREATE INDEX "SaleCancellation_createdAt_idx" ON "SaleCancellation"("createdAt");

-- CreateIndex
CREATE INDEX "SaleCancellation_createdById_idx" ON "SaleCancellation"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "DailyGoal_goalDate_key" ON "DailyGoal"("goalDate");

-- CreateIndex
CREATE INDEX "DailyGoal_goalDate_idx" ON "DailyGoal"("goalDate");

-- CreateIndex
CREATE INDEX "DailyGoal_entryCategoryId_idx" ON "DailyGoal"("entryCategoryId");

-- CreateIndex
CREATE INDEX "DailyGoal_consumptionCategoryId_idx" ON "DailyGoal"("consumptionCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyGoalPlan_monthStart_key" ON "MonthlyGoalPlan"("monthStart");

-- CreateIndex
CREATE INDEX "MonthlyGoalPlan_monthStart_idx" ON "MonthlyGoalPlan"("monthStart");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");

-- CreateIndex
CREATE INDEX "AccountPayable_status_dueDate_idx" ON "AccountPayable"("status", "dueDate");

-- CreateIndex
CREATE INDEX "AccountPayable_isRecurringMonthly_dueDay_idx" ON "AccountPayable"("isRecurringMonthly", "dueDay");

-- CreateIndex
CREATE INDEX "AccountPayable_dueDate_idx" ON "AccountPayable"("dueDate");

-- CreateIndex
CREATE INDEX "AccountPayable_createdAt_idx" ON "AccountPayable"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformTenant_slug_key" ON "PlatformTenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformTenant_databaseName_key" ON "PlatformTenant"("databaseName");

-- CreateIndex
CREATE INDEX "PlatformTenant_status_idx" ON "PlatformTenant"("status");

-- CreateIndex
CREATE INDEX "PlatformTenant_ownerEmail_idx" ON "PlatformTenant"("ownerEmail");

-- CreateIndex
CREATE INDEX "PlatformTenant_isDefault_idx" ON "PlatformTenant"("isDefault");

-- CreateIndex
CREATE INDEX "PlatformTenantUser_email_idx" ON "PlatformTenantUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformTenantUser_tenantId_email_key" ON "PlatformTenantUser"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformGatewayConfiguration_provider_key" ON "PlatformGatewayConfiguration"("provider");

-- CreateIndex
CREATE INDEX "PlatformGatewayConfiguration_provider_idx" ON "PlatformGatewayConfiguration"("provider");

-- CreateIndex
CREATE INDEX "PlatformGatewayConfiguration_status_idx" ON "PlatformGatewayConfiguration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSubscription_mercadoPagoPreapprovalId_key" ON "PlatformSubscription"("mercadoPagoPreapprovalId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSubscription_mercadoPagoExternalReference_key" ON "PlatformSubscription"("mercadoPagoExternalReference");

-- CreateIndex
CREATE INDEX "PlatformSubscription_tenantId_idx" ON "PlatformSubscription"("tenantId");

-- CreateIndex
CREATE INDEX "PlatformSubscription_status_idx" ON "PlatformSubscription"("status");

-- CreateIndex
CREATE INDEX "PlatformSubscription_planName_idx" ON "PlatformSubscription"("planName");

-- CreateIndex
CREATE INDEX "PlatformPaymentEvent_provider_idx" ON "PlatformPaymentEvent"("provider");

-- CreateIndex
CREATE INDEX "PlatformPaymentEvent_eventType_idx" ON "PlatformPaymentEvent"("eventType");

-- CreateIndex
CREATE INDEX "PlatformPaymentEvent_resourceId_idx" ON "PlatformPaymentEvent"("resourceId");

-- CreateIndex
CREATE INDEX "PlatformPaymentEvent_subscriptionId_idx" ON "PlatformPaymentEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX "PlatformPaymentEvent_tenantId_idx" ON "PlatformPaymentEvent"("tenantId");

-- CreateIndex
CREATE INDEX "PlatformPaymentEvent_status_idx" ON "PlatformPaymentEvent"("status");

-- CreateIndex
CREATE INDEX "SystemUpdate_createdAt_idx" ON "SystemUpdate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalConfiguration_scope_key" ON "FiscalConfiguration"("scope");

-- CreateIndex
CREATE INDEX "FiscalConfiguration_updatedAt_idx" ON "FiscalConfiguration"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PdvConfiguration_scope_key" ON "PdvConfiguration"("scope");

-- CreateIndex
CREATE INDEX "PdvConfiguration_updatedAt_idx" ON "PdvConfiguration"("updatedAt");

-- CreateIndex
CREATE INDEX "BrandCustomization_updatedAt_idx" ON "BrandCustomization"("updatedAt");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipeIngredient" ADD CONSTRAINT "ProductRecipeIngredient_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipeIngredient" ADD CONSTRAINT "ProductRecipeIngredient_ingredientProductId_fkey" FOREIGN KEY ("ingredientProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCategory" ADD CONSTRAINT "CouponCategory_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCategory" ADD CONSTRAINT "CouponCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockInvoiceXml" ADD CONSTRAINT "StockInvoiceXml_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleCoupon" ADD CONSTRAINT "SaleCoupon_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleCoupon" ADD CONSTRAINT "SaleCoupon_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_closedSaleId_fkey" FOREIGN KEY ("closedSaleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_serviceDeclarationId_fkey" FOREIGN KEY ("serviceDeclarationId") REFERENCES "ServiceFiscalDeclaration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceFiscalDeclaration" ADD CONSTRAINT "ServiceFiscalDeclaration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameplayRelease" ADD CONSTRAINT "GameplayRelease_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleCancellation" ADD CONSTRAINT "SaleCancellation_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleCancellation" ADD CONSTRAINT "SaleCancellation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyGoal" ADD CONSTRAINT "DailyGoal_entryCategoryId_fkey" FOREIGN KEY ("entryCategoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyGoal" ADD CONSTRAINT "DailyGoal_consumptionCategoryId_fkey" FOREIGN KEY ("consumptionCategoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyGoal" ADD CONSTRAINT "DailyGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyGoalPlan" ADD CONSTRAINT "MonthlyGoalPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformTenantUser" ADD CONSTRAINT "PlatformTenantUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PlatformTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSubscription" ADD CONSTRAINT "PlatformSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PlatformTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPaymentEvent" ADD CONSTRAINT "PlatformPaymentEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PlatformSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPaymentEvent" ADD CONSTRAINT "PlatformPaymentEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PlatformTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemUpdate" ADD CONSTRAINT "SystemUpdate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCustomization" ADD CONSTRAINT "BrandCustomization_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


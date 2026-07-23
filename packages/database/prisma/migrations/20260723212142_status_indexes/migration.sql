-- CreateIndex
CREATE INDEX "Employee_companyId_employmentStatus_idx" ON "Employee"("companyId", "employmentStatus");

-- CreateIndex
CREATE INDEX "Project_companyId_status_idx" ON "Project"("companyId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_status_idx" ON "PurchaseOrder"("companyId", "status");

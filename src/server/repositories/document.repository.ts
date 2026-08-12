import { query, queryOne, beginTransaction } from '../db/client';
import { documentStorageService } from '../services/document-storage.service';
import { generateId } from '../utils';
import { notificationService } from '../services/notification.service';
export class DocumentRepository {
  private initialized = false;

  async initSchema() {
    if (this.initialized) return;
    await documentStorageService.init();
    try {
      // Create migration tracking column safely
      await query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS migrated_to_v2 BOOLEAN DEFAULT FALSE;`);

      // Find all unmigrated documents
      const unmigrated = await query(`SELECT * FROM employee_documents WHERE migrated_to_v2 = FALSE`);

      for (const oldDoc of unmigrated) {
        const client = await beginTransaction();
        try {
          // 1. Get or create organization-scoped document type
          const categoryName = oldDoc.category || 'OTHER';
          const orgId = oldDoc.organization_id;
          if (!orgId) continue; // Skip if no orgId (should be backfilled)

          let docType = await client.queryOne(`SELECT id FROM document_types WHERE organization_id = $1 AND name = $2`, [orgId, categoryName]);
          if (!docType) {
            docType = await client.queryOne(`
              INSERT INTO document_types (organization_id, name, description) 
              VALUES ($1, $2, $3) RETURNING id
            `, [orgId, categoryName, `Imported category ${categoryName}`]);
          }

          // 2. Insert into documents table
          const newDoc = await client.queryOne(`
            INSERT INTO documents (
              id, organization_id, employee_id, document_type_id, document_name, 
              created_at, status, verification_status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'UPLOADED', 'VERIFIED')
            ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
            RETURNING id
          `, [
            oldDoc.id, orgId, oldDoc.employee_id, docType.id, oldDoc.title || oldDoc.file_name || 'Untitled Document',
            oldDoc.created_at || new Date()
          ]);

          // 3. Handle file storage
          let storageKey = oldDoc.file_path; // Default to old path if not base64
          let mimeType = oldDoc.file_type || 'application/octet-stream';
          const fileExtension = (oldDoc.file_name && oldDoc.file_name.includes('.')) ? oldDoc.file_name.split('.').pop() : 'pdf';
          const fileSize = oldDoc.file_size_bytes || 0;

          if (oldDoc.file_path && oldDoc.file_path.startsWith('data:')) {
            // It's a base64 string, extract and save to disk
            const matches = oldDoc.file_path.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              mimeType = matches[1];
              const buffer = Buffer.from(matches[2], 'base64');
              storageKey = documentStorageService.generateStorageKey(orgId, oldDoc.employee_id || 'org', oldDoc.id, 1, fileExtension);
              await documentStorageService.upload(storageKey, buffer);
            }
          }

          // 4. Insert into document_versions
          await client.queryOne(`
            INSERT INTO document_versions (
              document_id, version_number, original_file_name, storage_key, 
              mime_type, file_extension, file_size, uploaded_by, uploaded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (document_id, version_number) DO NOTHING
          `, [
            newDoc.id, 1, oldDoc.file_name || 'document.pdf', storageKey,
            mimeType, fileExtension, fileSize, oldDoc.uploaded_by_user_id, oldDoc.created_at || new Date()
          ]);

          // 5. Mark as migrated
          await client.query(`UPDATE employee_documents SET migrated_to_v2 = TRUE WHERE id = $1`, [oldDoc.id]);

          await client.commit();
        } catch (e) {
          console.warn(`Failed to migrate document ${oldDoc.id}:`, e);
          await client.rollback();
        }
      }
      this.initialized = true;
    } catch (err) {
      console.warn('Document schema migration error (Phase 10):', err);
    }
  }

  // Document Types
  async getDocumentTypes(orgId: string): Promise<any[]> {
    await this.initSchema();
    return query(`SELECT * FROM document_types WHERE organization_id = $1 ORDER BY name ASC`, [orgId]);
  }

  async getDocumentTypeByName(orgId: string, name: string): Promise<any> {
    await this.initSchema();
    return queryOne(`SELECT * FROM document_types WHERE organization_id = $1 AND name = $2`, [orgId, name]);
  }

  async createDocumentType(orgId: string, name: string, description?: string): Promise<any> {
    await this.initSchema();
    return queryOne(`
      INSERT INTO document_types (organization_id, name, description) 
      VALUES ($1, $2, $3) RETURNING *
    `, [orgId, name, description]);
  }

  // Documents
  async getDocuments(
    orgId: string,
    filters: { employeeId?: string; category?: string; status?: string; search?: string },
    pagination: { page: number; limit: number },
    sortBy: string = 'createdAt',
    sortOrder: string = 'DESC'
  ): Promise<{ data: any[]; pagination: any }> {
    await this.initSchema();

    let whereClause = `d.organization_id = $1 AND d.deleted_at IS NULL`;
    const params: any[] = [orgId];
    let paramIndex = 2;

    if (filters.employeeId) {
      if (filters.employeeId === 'COMPANY_WIDE') {
        whereClause += ` AND d.employee_id IS NULL`;
      } else {
        whereClause += ` AND d.employee_id = $${paramIndex++}`;
        params.push(filters.employeeId);
      }
    }

    if (filters.category && filters.category !== 'ALL') {
      whereClause += ` AND dt.name = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters.status && filters.status !== 'ALL') {
      whereClause += ` AND d.status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters.search) {
      whereClause += ` AND (d.document_name ILIKE $${paramIndex} OR e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex} OR dt.name ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const sortMap: Record<string, string> = {
      createdAt: 'd.created_at',
      documentName: 'd.document_name',
      expiryDate: 'd.expiry_date',
      status: 'd.status',
      verificationStatus: 'd.verification_status',
    };
    const sortCol = sortMap[sortBy] || 'd.created_at';
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM documents d
      LEFT JOIN document_types dt ON d.document_type_id = dt.id
      LEFT JOIN employees e ON d.employee_id = e.id
      WHERE ${whereClause}
    `;
    const countRes = await queryOne(countQuery, params);
    const total = parseInt(countRes.total, 10);

    const offset = (pagination.page - 1) * pagination.limit;
    
    // We join document_versions to get file_size, file_extension, storage_key from current version
    const dataQuery = `
      SELECT d.*, 
             dt.name as category,
             e.first_name, e.last_name, e.employee_code,
             dv.file_size, dv.file_extension, dv.original_file_name, dv.storage_key
      FROM documents d
      LEFT JOIN document_types dt ON d.document_type_id = dt.id
      LEFT JOIN employees e ON d.employee_id = e.id
      LEFT JOIN document_versions dv ON dv.document_id = d.id AND dv.version_number = d.version
      WHERE ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    params.push(pagination.limit, offset);
    const rows = await query(dataQuery, params);

    const formattedRows = rows.map(r => ({
      id: r.id,
      employeeId: r.employee_id || undefined,
      employeeName: (r.first_name && r.last_name) ? `${r.first_name} ${r.last_name}` : undefined,
      employeeCode: r.employee_code,
      title: r.document_name,
      category: r.category,
      fileName: r.original_file_name,
      fileType: r.file_extension,
      fileSizeBytes: r.file_size ? Number(r.file_size) : 0,
      fileSize: r.file_size ? `${(Number(r.file_size) / (1024 * 1024)).toFixed(1)} MB` : '0 MB',
      status: r.status,
      verificationStatus: r.verification_status,
      rejectionReason: r.rejection_reason,
      expiryDate: r.expiry_date,
      version: r.version,
      createdAt: r.created_at,
      fileUrl: `/api/documents/${r.id}/download`, // Expose secure download endpoint
    }));

    return {
      data: formattedRows,
      pagination: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }

  async getDocumentById(orgId: string, id: string): Promise<any | null> {
    await this.initSchema();
    const row = await queryOne(`
      SELECT d.*, 
             dt.name as category,
             e.first_name, e.last_name, e.employee_code, e.manager_id,
             dv.file_size, dv.file_extension, dv.original_file_name, dv.storage_key, dv.mime_type
      FROM documents d
      LEFT JOIN document_types dt ON d.document_type_id = dt.id
      LEFT JOIN employees e ON d.employee_id = e.id
      LEFT JOIN document_versions dv ON dv.document_id = d.id AND dv.version_number = d.version
      WHERE d.organization_id = $1 AND d.id = $2 AND d.deleted_at IS NULL
    `, [orgId, id]);

    if (!row) return null;

    return {
      id: row.id,
      employeeId: row.employee_id || undefined,
      employeeName: (row.first_name && row.last_name) ? `${row.first_name} ${row.last_name}` : undefined,
      employeeCode: row.employee_code,
      managerId: row.manager_id,
      title: row.document_name,
      category: row.category,
      fileName: row.original_file_name,
      fileExtension: row.file_extension,
      mimeType: row.mime_type,
      storageKey: row.storage_key,
      fileSizeBytes: row.file_size ? Number(row.file_size) : 0,
      status: row.status,
      verificationStatus: row.verification_status,
      rejectionReason: row.rejection_reason,
      expiryDate: row.expiry_date,
      version: row.version,
      createdAt: row.created_at
    };
  }

  async getDocumentVersions(orgId: string, docId: string): Promise<any[]> {
    return query(`
      SELECT dv.* 
      FROM document_versions dv
      JOIN documents d ON d.id = dv.document_id
      WHERE d.organization_id = $1 AND d.id = $2 AND d.deleted_at IS NULL
      ORDER BY dv.version_number DESC
    `, [orgId, docId]);
  }

  async uploadDocument(
    orgId: string,
    uploaderUserId: string,
    docData: {
      employeeId?: string;
      title: string;
      category: string;
      description?: string;
      expiryDate?: string;
    },
    fileData: {
      originalName: string;
      mimeType: string;
      extension: string;
      size: number;
      buffer: Buffer;
    }
  ): Promise<any> {
    await this.initSchema();
    const client = await beginTransaction();
    let storageKey = '';
    
    try {
      // Get or create category
      let docType = await client.queryOne(`SELECT id FROM document_types WHERE organization_id = $1 AND name = $2`, [orgId, docData.category]);
      if (!docType) {
        docType = await client.queryOne(`
          INSERT INTO document_types (organization_id, name) VALUES ($1, $2) RETURNING id
        `, [orgId, docData.category]);
      }

      // Check if updating an existing document for this employee/type
      // But usually uploads via UI are explicit new documents unless it's a replacement.
      // We will create a new document for now. (The UI sends ID if it's a replacement, but we'll assume it's new for this method).
      const docId = generateId();
      storageKey = documentStorageService.generateStorageKey(orgId, docData.employeeId || 'org', docId, 1, fileData.extension);

      // Save physical file
      await documentStorageService.upload(storageKey, fileData.buffer);

      // Insert Metadata
      const newDoc = await client.queryOne(`
        INSERT INTO documents (
          id, organization_id, employee_id, document_type_id, document_name, description, expiry_date, version, status, verification_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'UPLOADED', 'PENDING')
        RETURNING *
      `, [docId, orgId, docData.employeeId || null, docType.id, docData.title, docData.description, docData.expiryDate || null]);

      await client.queryOne(`
        INSERT INTO document_versions (
          document_id, version_number, original_file_name, storage_key, mime_type, file_extension, file_size, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [docId, 1, fileData.originalName, storageKey, fileData.mimeType, fileData.extension, fileData.size, uploaderUserId]);

      await client.commit();
      return this.getDocumentById(orgId, docId);
    } catch (err) {
      await client.rollback();
      // Clean up orphaned file
      if (storageKey) await documentStorageService.delete(storageKey).catch(console.error);
      throw err;
    }
  }

  async uploadDocumentVersion(
    orgId: string,
    docId: string,
    uploaderUserId: string,
    fileData: {
      originalName: string;
      mimeType: string;
      extension: string;
      size: number;
      buffer: Buffer;
    }
  ): Promise<any> {
    await this.initSchema();
    const client = await beginTransaction();
    let storageKey = '';
    
    try {
      const doc = await client.queryOne(`SELECT * FROM documents WHERE organization_id = $1 AND id = $2 FOR UPDATE`, [orgId, docId]);
      if (!doc || doc.deleted_at) {
        throw new Error("Document not found");
      }

      const nextVersion = doc.version + 1;
      storageKey = documentStorageService.generateStorageKey(orgId, doc.employee_id || 'org', docId, nextVersion, fileData.extension);

      // Save physical file
      await documentStorageService.upload(storageKey, fileData.buffer);

      // Insert new version
      await client.queryOne(`
        INSERT INTO document_versions (
          document_id, version_number, original_file_name, storage_key, mime_type, file_extension, file_size, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [docId, nextVersion, fileData.originalName, storageKey, fileData.mimeType, fileData.extension, fileData.size, uploaderUserId]);

      // Update document current version and reset verification status
      await client.queryOne(`
        UPDATE documents 
        SET version = $1, status = 'UPLOADED', verification_status = 'PENDING', verified_by = NULL, verified_at = NULL, rejection_reason = NULL, updated_at = NOW()
        WHERE id = $2
      `, [nextVersion, docId]);

      await client.commit();
      return this.getDocumentById(orgId, docId);
    } catch (err) {
      await client.rollback();
      if (storageKey) await documentStorageService.delete(storageKey).catch(console.error);
      throw err;
    }
  }

  async verifyDocument(orgId: string, id: string, verifierId: string): Promise<any> {
    const doc = await queryOne(`
      UPDATE documents 
      SET status = 'VERIFIED', verification_status = 'VERIFIED', verified_by = $1, verified_at = NOW(), rejection_reason = NULL, updated_at = NOW()
      WHERE organization_id = $2 AND id = $3 AND deleted_at IS NULL
      RETURNING *
    `, [verifierId, orgId, id]);
    if (doc) {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientEmployeeId: doc.employee_id,
        notificationType: 'DOCUMENT_VERIFIED',
        title: 'Document Verified',
        message: 'Your document has been verified.',
        entityType: 'DOCUMENT',
        entityId: doc.id,
        priority: 'NORMAL'
      });
    }
    return doc;
  }

  async rejectDocument(orgId: string, id: string, verifierId: string, reason: string): Promise<any> {
    const doc = await queryOne(`
      UPDATE documents 
      SET status = 'REJECTED', verification_status = 'REJECTED', verified_by = $1, verified_at = NOW(), rejection_reason = $2, updated_at = NOW()
      WHERE organization_id = $3 AND id = $4 AND deleted_at IS NULL
      RETURNING *
    `, [verifierId, reason, orgId, id]);
    if (doc) {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientEmployeeId: doc.employee_id,
        notificationType: 'DOCUMENT_REJECTED',
        title: 'Document Rejected',
        message: `Your document was rejected: ${reason}`,
        entityType: 'DOCUMENT',
        entityId: doc.id,
        priority: 'HIGH'
      });
    }
    return doc;
  }

  async deleteDocument(orgId: string, id: string): Promise<void> {
    // Soft delete
    await query(`UPDATE documents SET deleted_at = NOW(), updated_at = NOW() WHERE organization_id = $1 AND id = $2`, [orgId, id]);
  }

  async getEmployeeById(orgId: string, id: string): Promise<any | null> {
    const rows = await query(`
      SELECT e.*, d.name as department_name 
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.organization_id = $1 AND e.id = $2
    `, [orgId, id]);
    return rows.length ? rows[0] : null;
  }

  async getReporteeIds(orgId: string, managerId: string): Promise<string[]> {
    const rows = await query(`SELECT id FROM employees WHERE organization_id = $1 AND manager_id = $2`, [orgId, managerId]);
    return rows.map(r => r.id);
  }
}

export const documentRepository = new DocumentRepository();

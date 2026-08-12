import { Router, Request, Response } from 'express';
import { authenticateToken, requireRoles, requirePermission, AuthenticatedRequest } from '../auth';
import { helpdeskRepository } from '../repositories/helpdesk.repository';
import { logAudit } from '../utils';
import { notificationService } from '../services/notification.service';

export const helpdeskRouter = Router();

helpdeskRouter.get('/helpdesk/tickets', authenticateToken, requirePermission('helpdesk.read'), async (req: AuthenticatedRequest, res: Response) => {
  const tickets = await helpdeskRepository.getTickets(
    req.user!.organizationId,
    req.user!.role,
    req.user!.employeeId!,
    req.query
  );
  return res.json(tickets);
});

helpdeskRouter.post('/helpdesk/tickets', authenticateToken, requirePermission('helpdesk.create'), async (req: AuthenticatedRequest, res: Response) => {
  const { subject, description, category, priority } = req.body;
  if (!subject || !description || !category) {
    return res.status(400).json({ error: 'Subject, description, and category are required' });
  }

  const newTicket = await helpdeskRepository.createTicket({
    organizationId: req.user!.organizationId,
    employeeId: req.user!.employeeId!,
    subject,
    description,
    category,
    priority: priority || 'MEDIUM',
    status: 'OPEN',
    createdBy: req.user!.employeeId || req.user!.userId
  });

  await logAudit(
    req.user!.organizationId,
    req.user!.userId,
    req.user!.email,
    req.user!.email, // username is not easily available, passing email
    'CREATE_TICKET',
    'HELPDESK',
    newTicket.id,
    `Created ticket ${newTicket.ticketNumber}`
  );

  return res.status(201).json(newTicket);
});

helpdeskRouter.get('/helpdesk/tickets/:id', authenticateToken, requirePermission('helpdesk.read'), async (req: AuthenticatedRequest, res: Response) => {
  const ticket = await helpdeskRepository.getTicket(req.user!.organizationId, req.params.id, req.user!.role, req.user!.employeeId!);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  return res.json(ticket);
});

helpdeskRouter.patch('/helpdesk/tickets/:id/status', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });

  const ticket = await helpdeskRepository.getTicket(req.user!.organizationId, req.params.id, req.user!.role, req.user!.employeeId!);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const resolvedAt = status === 'RESOLVED' ? new Date().toISOString() : undefined;
  const closedAt = status === 'CLOSED' ? new Date().toISOString() : undefined;
  
  await helpdeskRepository.updateTicketStatus(req.user!.organizationId, ticket.id, status, resolvedAt, closedAt);
  
  await logAudit(
    req.user!.organizationId,
    req.user!.userId,
    req.user!.email,
    req.user!.email,
    'UPDATE_TICKET_STATUS',
    'HELPDESK',
    ticket.id,
    `Updated ticket ${ticket.ticketNumber} status to ${status}`
  );

  if (ticket.employeeId) {
    await notificationService.createNotification({
      organizationId: req.user!.organizationId,
      recipientEmployeeId: ticket.employeeId,
      notificationType: 'TICKET_STATUS_UPDATED',
      entityType: 'TICKET',
      entityId: ticket.id,
      title: 'Ticket Status Updated',
      message: `Your ticket ${ticket.ticketNumber} status was updated to ${status}.`
    });
  }

  return res.json({ ...ticket, status, resolvedAt, closedAt });
});

helpdeskRouter.patch('/helpdesk/tickets/:id/assign', authenticateToken, requireRoles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const { assignedTo } = req.body;
  if (!assignedTo) return res.status(400).json({ error: 'assignedTo is required' });

  const ticket = await helpdeskRepository.getTicket(req.user!.organizationId, req.params.id, req.user!.role, req.user!.employeeId!);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  await helpdeskRepository.assignTicket(req.user!.organizationId, ticket.id, assignedTo);

  await logAudit(
    req.user!.organizationId,
    req.user!.userId,
    req.user!.email,
    req.user!.email,
    'ASSIGN_TICKET',
    'HELPDESK',
    ticket.id,
    `Assigned ticket ${ticket.ticketNumber} to ${assignedTo}`
  );

  await notificationService.createNotification({
    organizationId: req.user!.organizationId,
    recipientEmployeeId: assignedTo,
    notificationType: 'TICKET_ASSIGNED',
    entityType: 'TICKET',
    entityId: ticket.id,
    title: 'Ticket Assigned',
    message: `You have been assigned ticket ${ticket.ticketNumber}.`
  });

  return res.json({ ...ticket, assignedTo });
});

helpdeskRouter.post('/helpdesk/tickets/:id/comments', authenticateToken, requirePermission('helpdesk.comment'), async (req: AuthenticatedRequest, res: Response) => {
  const { comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'Comment is required' });

  const ticket = await helpdeskRepository.getTicket(req.user!.organizationId, req.params.id, req.user!.role, req.user!.employeeId!);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const newComment = await helpdeskRepository.addComment({
    organizationId: req.user!.organizationId,
    ticketId: ticket.id,
    authorEmployeeId: req.user!.employeeId,
    comment
  });

  await logAudit(
    req.user!.organizationId,
    req.user!.userId,
    req.user!.email,
    req.user!.email,
    'ADD_TICKET_COMMENT',
    'HELPDESK',
    ticket.id,
    `Added comment to ticket ${ticket.ticketNumber}`
  );

  if (req.user!.employeeId !== ticket.employeeId && ticket.employeeId) {
    await notificationService.createNotification({
      organizationId: req.user!.organizationId,
      recipientEmployeeId: ticket.employeeId,
      notificationType: 'TICKET_COMMENTED',
      entityType: 'TICKET',
      entityId: ticket.id,
      title: 'New Comment on Ticket',
      message: `A new comment was added to your ticket ${ticket.ticketNumber}.`
    });
  } else if (ticket.assignedTo && req.user!.employeeId !== ticket.assignedTo) {
    await notificationService.createNotification({
      organizationId: req.user!.organizationId,
      recipientEmployeeId: ticket.assignedTo,
      notificationType: 'TICKET_COMMENTED',
      entityType: 'TICKET',
      entityId: ticket.id,
      title: 'New Comment on Ticket',
      message: `A new comment was added to ticket ${ticket.ticketNumber} assigned to you.`
    });
  }

  return res.status(201).json(newComment);
});

helpdeskRouter.get('/helpdesk/tickets/:id/comments', authenticateToken, requirePermission('helpdesk.read'), async (req: AuthenticatedRequest, res: Response) => {
  const ticket = await helpdeskRepository.getTicket(req.user!.organizationId, req.params.id, req.user!.role, req.user!.employeeId!);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  
  const comments = await helpdeskRepository.getTicketComments(req.user!.organizationId, ticket.id);
  return res.json(comments);
});

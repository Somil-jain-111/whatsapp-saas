import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { QueryFailedError } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ContactsRepository } from "./contacts.repository";
import {
  ConsentDto,
  ContactListDto,
  CreateContactDto,
  CreateSegmentDto,
  CreateTagDto,
  UpdateContactDto,
} from "./dto/contact.dto";

@Injectable()
export class ContactsService {
  constructor(
    private readonly repo: ContactsRepository,
    private readonly events: EventEmitter2,
  ) {}
  async create(org: string, user: string, dto: CreateContactDto) {
    try {
      const created = await this.repo.create(org, user, dto);
      if (!created) throw new ConflictException("Contact quota exceeded");
      this.events.emit("automation.trigger", {
        organizationId: org,
        externalId: `contact-created:${created.id}`,
        type: "CONTACT_CREATED",
        sourceType: "CONTACT",
        sourceId: created.id,
        occurredAt: created.created_at ?? new Date(),
        payload: { contactId: created.id },
      });
      return created;
    } catch (e) {
      if (
        e instanceof QueryFailedError &&
        (e as any).driverError?.code === "23505"
      )
        throw new ConflictException("Contact phone already exists");
      throw e;
    }
  }
  list(org: string, dto: ContactListDto) {
    return this.repo.list(org, dto);
  }
  async get(org: string, id: string) {
    const value = await this.repo.get(org, id);
    if (!value) throw new NotFoundException("Contact not found");
    return value;
  }
  async update(org: string, id: string, dto: UpdateContactDto) {
    const value = await this.repo.update(org, id, dto);
    if (!value) throw new NotFoundException("Contact not found");
    return value;
  }
  async remove(org: string, id: string) {
    if (!(await this.repo.remove(org, id)))
      throw new NotFoundException("Contact not found");
  }
  consent(org: string, dto: ConsentDto) {
    return this.repo.consent(org, dto);
  }
  createTag(org: string, dto: CreateTagDto) {
    return this.repo.createTag(org, dto.name);
  }
  tags(org: string) {
    return this.repo.listTags(org);
  }
  createSegment(org: string, user: string, dto: CreateSegmentDto) {
    return this.repo.createSegment(org, user, dto.name, dto.definition);
  }
  segments(org: string) {
    return this.repo.listSegments(org);
  }
  async segment(org: string, id: string) {
    const value = await this.repo.getSegment(org, id);
    if (!value) throw new NotFoundException("Segment not found");
    return value;
  }
}

import { PartialType } from '@nestjs/swagger';
import { CreateManageBranchDto } from './create-manage_branch.dto';

export class UpdateManageBranchDto extends PartialType(CreateManageBranchDto) {}

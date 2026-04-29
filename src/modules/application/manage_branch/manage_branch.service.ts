import { Injectable } from '@nestjs/common';
import { CreateManageBranchDto } from './dto/create-manage_branch.dto';
import { UpdateManageBranchDto } from './dto/update-manage_branch.dto';

@Injectable()
export class ManageBranchService {
  create(createManageBranchDto: CreateManageBranchDto) {
    return 'This action adds a new manageBranch';
  }

  findAll() {
    return `This action returns all manageBranch`;
  }

  findOne(id: number) {
    return `This action returns a #${id} manageBranch`;
  }

  update(id: number, updateManageBranchDto: UpdateManageBranchDto) {
    return `This action updates a #${id} manageBranch`;
  }

  remove(id: number) {
    return `This action removes a #${id} manageBranch`;
  }
}

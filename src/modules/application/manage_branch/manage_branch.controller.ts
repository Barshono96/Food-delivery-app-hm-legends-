import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ManageBranchService } from './manage_branch.service';
import { CreateManageBranchDto } from './dto/create-manage_branch.dto';
import { UpdateManageBranchDto } from './dto/update-manage_branch.dto';

@Controller('manage-branch')
export class ManageBranchController {
  constructor(private readonly manageBranchService: ManageBranchService) {}

  @Post()
  create(@Body() createManageBranchDto: CreateManageBranchDto) {
    return this.manageBranchService.create(createManageBranchDto);
  }

  @Get()
  findAll() {
    return this.manageBranchService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.manageBranchService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateManageBranchDto: UpdateManageBranchDto,
  ) {
    return this.manageBranchService.update(+id, updateManageBranchDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.manageBranchService.remove(+id);
  }
}

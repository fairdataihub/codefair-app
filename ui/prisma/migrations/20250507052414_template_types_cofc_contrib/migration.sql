-- AlterTable
ALTER TABLE "CodeofConductValidation" ADD COLUMN     "code_template_type" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ContributingValidation" ADD COLUMN     "contrib_template_type" TEXT NOT NULL DEFAULT '';

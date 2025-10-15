import mongoose, { Schema, Document, Model } from 'mongoose';

interface McpTemplateVersion extends Document {
	version: string;
}

const mcpTemplateVersionSchema = new Schema<McpTemplateVersion>({
	version: { type: String, required: true },
});

const McpTemplateVersion: Model<McpTemplateVersion> = mongoose.model(
	'McpTemplateVersion',
	mcpTemplateVersionSchema
);

export default McpTemplateVersion;

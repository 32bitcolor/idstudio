import Link from "next/link";
import { Lead, H2, H3, P, UL, LI, Steps, Callout, DefList, Def, UI } from "@/components/help/prose";

export default function Courses() {
  return (
    <>
      <Lead>
        Courses are IDStudio&rsquo;s block-based authoring tool — build a responsive course out of
        content and interactive blocks, preview it as a learner, and (soon) export it to your LMS.
        Think of it as the &ldquo;build&rdquo; step that follows your storyboard.
      </Lead>

      <Callout tone="note">
        IDStudio authors courses; your <strong>LMS delivers them</strong>. Use{" "}
        <UI>Export</UI> (top-right of the editor) to download a self-contained package in{" "}
        <strong>SCORM 1.2</strong>, <strong>SCORM 2004</strong>, or <strong>xAPI (Tin Can)</strong>,
        then upload it to any LMS — it plays standalone and reports completion, score, and
        per-question results back.
      </Callout>

      <H2>Structure: course → lessons → blocks</H2>
      <UL>
        <LI>A <strong>course</strong> is a stack of lessons with a title, description, and a Draft / Published status.</LI>
        <LI>Each <strong>lesson</strong> is a stack of <strong>blocks</strong> — the content the learner scrolls through.</LI>
        <LI>Use the <strong>Lessons</strong> rail on the left to add, rename, reorder, and switch between lessons.</LI>
      </UL>

      <H2>Blocks</H2>
      <P>Click <UI>Add a block</UI> and pick a type:</P>
      <DefList>
        <Def term="Heading">A section title (H1–H3).</Def>
        <Def term="Text">A rich paragraph with bold, italic, and lists.</Def>
        <Def term="Statement">A short, emphasized callout for a key point.</Def>
        <Def term="Image">An image with alt text and an optional caption.</Def>
        <Def term="Divider">A simple horizontal rule between sections.</Def>
        <Def term="Accordion">Collapsible sections the learner expands one at a time.</Def>
        <Def term="Knowledge check">A multiple-choice question with per-answer feedback.</Def>
      </DefList>
      <P>
        Reorder blocks with the up/down controls that appear on hover, and delete with the trash
        icon. Everything autosaves as you edit.
      </P>

      <H2>Preview like a learner</H2>
      <P>
        Toggle <UI>Preview</UI> (top-right) to see the current lesson exactly as a learner will —
        themed, responsive, and interactive. Accordions expand, and knowledge checks accept an answer
        and reveal feedback. Toggle back to <UI>Edit</UI> to keep building.
      </P>

      <H3>Aligned to your objectives</H3>
      <P>
        When a course is created from a project&rsquo;s <strong>course</strong> deliverable, its
        knowledge-check blocks can tag which{" "}
        <Link href="/help/objectives-alignment" className="font-medium text-accent underline underline-offset-2">
          learning objectives
        </Link>{" "}
        they assess — keeping the build aligned to the design.
      </P>

      <H2>Exporting to your LMS</H2>
      <P>
        When a course is ready, click <UI>Export</UI> and choose a format:
      </P>
      <DefList>
        <Def term="SCORM 1.2">The most widely supported format — the safe default for most LMSs.</Def>
        <Def term="SCORM 2004">Newer SCORM with richer status and scoring, if your LMS prefers it.</Def>
        <Def term="xAPI (Tin Can)">Sends statements to an LRS — for modern learning-record tracking.</Def>
      </DefList>
      <P>
        You&rsquo;ll get a <code>.zip</code> to upload to your LMS as-is. Each package is a standalone
        player: the learner scrolls the lessons, answers knowledge checks, and their completion,
        score, and per-question results report back to the LMS.
      </P>

      <H2>A good first course</H2>
      <Steps>
        <>From <strong>Courses</strong>, click <UI>Create course</UI> (or open a project&rsquo;s <em>course</em> deliverable and choose <UI>Create course</UI>).</>
        <>Rename Lesson 1 and start adding blocks — a heading, some text, a statement, an image.</>
        <>Add a <strong>knowledge check</strong>: write the question, add options, mark the correct one, and write feedback.</>
        <>Add more lessons for each chunk of the course, then hit <UI>Preview</UI> to walk it as a learner.</>
      </Steps>

      <Callout tone="tip">
        Building from a storyboard? Keep the storyboard open in one tab and the course in another —
        translate each screen into blocks. The storyboard is the plan; the course is the build.
      </Callout>
    </>
  );
}
